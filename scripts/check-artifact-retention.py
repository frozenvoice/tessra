#!/usr/bin/env python3
"""actions/upload-artifact 의 retention-days 누락을 검사한다.

표준 라이브러리만 사용한다. PyYAML 기본 로더는 YAML 1.1에서 키 `on`을
불리언으로 읽으므로 트리거 경고에 쓰지 않는다.

종료 코드:
  0  retention-days 누락이 없다. push / pull_request / schedule 경고가 있어도 0이다.
  1  retention-days 누락, 파싱 실패, 또는 검사할 워크플로가 없다.
"""

from __future__ import annotations

import sys
from pathlib import Path


WARN_TRIGGERS = frozenset({"push", "pull_request", "schedule"})
UPLOAD_PREFIX = "actions/upload-artifact"


class MapNode(dict):
    def __init__(self, line: int) -> None:
        super().__init__()
        self.line = line
        self.key_lines: dict[str, int] = {}

    def add(self, key: str, value: object, line: int) -> None:
        self[key] = value
        self.key_lines[key] = line


class SeqNode(list):
    def __init__(self, line: int) -> None:
        super().__init__()
        self.line = line


class YamlError(Exception):
    def __init__(self, message: str, line: int | None = None) -> None:
        self.line = line
        super().__init__(message)


def _strip_comment(line: str) -> str:
    in_single = False
    in_double = False
    i = 0
    while i < len(line):
        ch = line[i]
        if in_single:
            if ch == "'":
                if i + 1 < len(line) and line[i + 1] == "'":
                    i += 2
                    continue
                in_single = False
            i += 1
            continue
        if in_double:
            if ch == "\\":
                i += 2
                continue
            if ch == '"':
                in_double = False
            i += 1
            continue
        if ch == "'":
            in_single = True
        elif ch == '"':
            in_double = True
        elif ch == "#":
            return line[:i]
        i += 1
    return line


def _unquote(token: str) -> str:
    token = token.strip()
    if len(token) >= 2 and token[0] == token[-1] and token[0] in "'\"":
        inner = token[1:-1]
        if token[0] == "'":
            return inner.replace("''", "'")
        return inner.replace(r"\"", '"').replace(r"\\", "\\")
    return token


def _parse_scalar(token: str):
    token = token.strip()
    if token in ("", "~", "null", "Null", "NULL"):
        return None
    if len(token) >= 2 and token[0] == token[-1] and token[0] in "'\"":
        return _unquote(token)
    return token


def _mapping_key_value(text: str) -> tuple[str, str] | None:
    in_single = False
    in_double = False
    i = 0
    while i < len(text):
        ch = text[i]
        if in_single:
            if ch == "'":
                if i + 1 < len(text) and text[i + 1] == "'":
                    i += 2
                    continue
                in_single = False
            i += 1
            continue
        if in_double:
            if ch == "\\":
                i += 2
                continue
            if ch == '"':
                in_double = False
            i += 1
            continue
        if ch == "'":
            in_single = True
        elif ch == '"':
            in_double = True
        elif ch == ":":
            key = text[:i].strip()
            rest = text[i + 1 :]
            quoted = len(key) >= 2 and key[0] == key[-1] and key[0] in "'\""
            if quoted or rest == "" or rest[0] in " \t":
                if key == "":
                    return None
                return _unquote(key), rest.strip()
        i += 1
    return None


def _is_block_scalar_header(value: str) -> bool:
    if not value or value[0] not in "|>":
        return False
    rest = value[1:]
    if rest[:1].isdigit():
        if rest[0] == "0":
            return False
        rest = rest[1:]
    return rest in ("", "+", "-")


def _flow_balanced(text: str) -> bool:
    if not text or text[0] not in "[{":
        return True
    depth = 0
    in_single = False
    in_double = False
    i = 0
    while i < len(text):
        ch = text[i]
        if in_single:
            if ch == "'":
                if i + 1 < len(text) and text[i + 1] == "'":
                    i += 2
                    continue
                in_single = False
            i += 1
            continue
        if in_double:
            if ch == "\\":
                i += 2
                continue
            if ch == '"':
                in_double = False
            i += 1
            continue
        if ch == "'":
            in_single = True
        elif ch == '"':
            in_double = True
        elif ch in "[{":
            depth += 1
        elif ch in "]}":
            depth -= 1
            if depth == 0:
                return text[i + 1 :].strip() == ""
            if depth < 0:
                return False
        i += 1
    return False


class _FlowParser:
    def __init__(self, text: str, line: int) -> None:
        self.text = text.strip()
        self.line = line
        self.pos = 0
        self.n = len(self.text)

    def peek(self) -> str:
        return self.text[self.pos] if self.pos < self.n else ""

    def skip(self) -> None:
        while self.pos < self.n and self.text[self.pos] in " \t":
            self.pos += 1

    def parse_quoted(self) -> str:
        quote = self.text[self.pos]
        self.pos += 1
        chars: list[str] = []
        while self.pos < self.n:
            ch = self.text[self.pos]
            if quote == "'" and ch == "'":
                if self.pos + 1 < self.n and self.text[self.pos + 1] == "'":
                    chars.append("'")
                    self.pos += 2
                    continue
                self.pos += 1
                return "".join(chars)
            if quote == '"' and ch == "\\":
                if self.pos + 1 >= self.n:
                    break
                chars.append(self.text[self.pos + 1])
                self.pos += 2
                continue
            if ch == quote:
                self.pos += 1
                return "".join(chars)
            chars.append(ch)
            self.pos += 1
        raise YamlError("따옴표가 닫히지 않았습니다", self.line)

    def parse_key(self) -> str:
        self.skip()
        if self.peek() in "'\"":
            return self.parse_quoted()
        start = self.pos
        while self.pos < self.n and self.text[self.pos] not in ":{},[]":
            self.pos += 1
        key = self.text[start:self.pos].strip()
        if key == "":
            raise YamlError("흐름 매핑 키가 비어 있습니다", self.line)
        return str(_parse_scalar(key))

    def parse_plain_value(self):
        start = self.pos
        in_single = False
        in_double = False
        while self.pos < self.n:
            ch = self.text[self.pos]
            if in_single:
                if ch == "'":
                    if self.pos + 1 < self.n and self.text[self.pos + 1] == "'":
                        self.pos += 2
                        continue
                    in_single = False
                self.pos += 1
                continue
            if in_double:
                if ch == "\\":
                    self.pos += 2
                    continue
                if ch == '"':
                    in_double = False
                self.pos += 1
                continue
            if ch == "'":
                in_single = True
            elif ch == '"':
                in_double = True
            elif ch in ",}]":
                break
            self.pos += 1
        return _parse_scalar(self.text[start:self.pos].strip())

    def parse_value(self):
        self.skip()
        ch = self.peek()
        if ch == "[":
            return self.parse_seq()
        if ch == "{":
            return self.parse_map()
        if ch in "'\"":
            return self.parse_quoted()
        if ch == "":
            raise YamlError("흐름 값이 비어 있습니다", self.line)
        return self.parse_plain_value()

    def parse_seq(self) -> SeqNode:
        self.pos += 1
        node = SeqNode(self.line)
        while True:
            self.skip()
            if self.peek() == "]":
                self.pos += 1
                return node
            node.append(self.parse_value())
            self.skip()
            if self.peek() == ",":
                self.pos += 1
                continue
            if self.peek() == "]":
                self.pos += 1
                return node
            raise YamlError("흐름 시퀀스를 닫지 못했습니다", self.line)

    def parse_map(self) -> MapNode:
        self.pos += 1
        node = MapNode(self.line)
        while True:
            self.skip()
            if self.peek() == "}":
                self.pos += 1
                return node
            key = self.parse_key()
            self.skip()
            if self.peek() != ":":
                raise YamlError("흐름 매핑에 ':'가 없습니다", self.line)
            self.pos += 1
            value = self.parse_value()
            node.add(key, value, self.line)
            self.skip()
            if self.peek() == ",":
                self.pos += 1
                continue
            if self.peek() == "}":
                self.pos += 1
                return node
            raise YamlError("흐름 매핑을 닫지 못했습니다", self.line)

    def parse(self):
        self.skip()
        value = self.parse_value()
        self.skip()
        if self.pos != self.n:
            raise YamlError("흐름 값 뒤에 문자가 남았습니다", self.line)
        return value


def parse_flow(text: str, line: int):
    return _FlowParser(text, line).parse()


def _indent_has_tab(raw: str) -> bool:
    prefix = raw[: len(raw) - len(raw.lstrip(" \t"))]
    return "\t" in prefix


def _prepare(text: str) -> list[tuple[int, str]]:
    lines: list[tuple[int, str]] = []
    for lineno, raw in enumerate(text.splitlines(), 1):
        if raw.startswith("\ufeff"):
            raw = raw.lstrip("\ufeff")
        lines.append((lineno, raw))
    return lines


def _next_content(prepared: list[tuple[int, str]], idx: int):
    while idx < len(prepared):
        lineno, raw = prepared[idx]
        if raw.strip() != "" and _indent_has_tab(raw):
            raise YamlError("들여쓰기에 탭이 있습니다", lineno)
        content = _strip_comment(raw).rstrip()
        if content.strip() == "" or content.strip() in ("---", "..."):
            if content.strip() in ("---", "...") and any(item.strip() for _n, item in prepared[:idx]):
                return None
            idx += 1
            continue
        indent = len(content) - len(content.lstrip(" "))
        return idx, lineno, indent, content.strip()
    return None


def _consume_block_scalar(prepared: list[tuple[int, str]], idx: int, key_indent: int):
    chunks: list[str] = []
    while idx < len(prepared):
        lineno, raw = prepared[idx]
        if raw.strip() == "":
            chunks.append("")
            idx += 1
            continue
        if _indent_has_tab(raw):
            raise YamlError("들여쓰기에 탭이 있습니다", lineno)
        indent = len(raw) - len(raw.lstrip(" "))
        if indent <= key_indent:
            break
        chunks.append(raw.strip())
        idx += 1
    return "\n".join(chunks).strip(), idx


def _parse_value(prepared, idx: int, key_indent: int, key_line: int, value_src: str):
    value_src = value_src.strip()
    if _is_block_scalar_header(value_src):
        return _consume_block_scalar(prepared, idx, key_indent)
    if value_src.startswith("[") or value_src.startswith("{"):
        combined = value_src
        while not _flow_balanced(combined):
            if idx >= len(prepared):
                raise YamlError("흐름 컬렉션이 닫히지 않았습니다", key_line)
            _lineno, raw = prepared[idx]
            extra = _strip_comment(raw).strip()
            idx += 1
            if extra in ("", "---", "..."):
                continue
            combined += " " + extra
        return parse_flow(combined, key_line), idx
    if value_src != "":
        return _parse_scalar(value_src), idx
    peeked = _next_content(prepared, idx)
    if peeked is None:
        return None, idx
    _i, lineno, indent, text = peeked
    if indent <= key_indent:
        return None, idx
    if text == "-" or text.startswith("- ") or _mapping_key_value(text) is not None:
        return _parse_block(prepared, idx, key_indent)
    raise YamlError("값을 이어서 읽지 못했습니다", lineno)


def _extend_map(prepared, idx: int, node: MapNode, key_indent: int) -> int:
    while True:
        peeked = _next_content(prepared, idx)
        if peeked is None:
            return idx
        i, lineno, indent, text = peeked
        if indent != key_indent or text == "-" or text.startswith("- "):
            return idx
        mapping = _mapping_key_value(text)
        if mapping is None:
            return idx
        key, value_src = mapping
        idx = i + 1
        value, idx = _parse_value(prepared, idx, key_indent, lineno, value_src)
        node.add(key, value, lineno)


def _parse_map(prepared, idx: int, map_indent: int):
    node: MapNode | None = None
    while True:
        peeked = _next_content(prepared, idx)
        if peeked is None:
            break
        i, lineno, indent, text = peeked
        if indent != map_indent:
            if node is None:
                raise YamlError("매핑 들여쓰기가 맞지 않습니다", lineno)
            if indent > map_indent:
                raise YamlError("매핑 들여쓰기가 맞지 않습니다", lineno)
            break
        mapping = _mapping_key_value(text)
        if mapping is None:
            raise YamlError("매핑 항목을 읽지 못했습니다", lineno)
        key, value_src = mapping
        if node is None:
            node = MapNode(lineno)
        idx = i + 1
        value, idx = _parse_value(prepared, idx, map_indent, lineno, value_src)
        node.add(key, value, lineno)
    return node if node is not None else MapNode(0), idx


def _parse_seq(prepared, idx: int, seq_indent: int):
    node: SeqNode | None = None
    while True:
        peeked = _next_content(prepared, idx)
        if peeked is None:
            break
        i, lineno, indent, text = peeked
        is_item = indent == seq_indent and (text == "-" or text.startswith("- "))
        if not is_item:
            if node is None:
                raise YamlError("시퀀스가 아닙니다", lineno)
            break
        if node is None:
            node = SeqNode(lineno)
        body = text[1:].strip()
        key_col = indent + 1 + (len(text[1:]) - len(text[1:].lstrip(" ")))
        idx = i + 1
        if body == "":
            child, idx = _parse_block(prepared, idx, indent)
            node.append(child)
            continue
        mapping = _mapping_key_value(body)
        if mapping is not None:
            key, value_src = mapping
            item = MapNode(lineno)
            value, idx = _parse_value(prepared, idx, key_col, lineno, value_src)
            item.add(key, value, lineno)
            idx = _extend_map(prepared, idx, item, key_col)
            node.append(item)
            continue
        value, idx = _parse_value(prepared, idx, indent, lineno, body)
        node.append(value)
    return node if node is not None else SeqNode(0), idx


def _parse_block(prepared, idx: int, parent_indent: int):
    peeked = _next_content(prepared, idx)
    if peeked is None:
        return None, idx
    _i, _lineno, indent, text = peeked
    if indent <= parent_indent:
        return None, idx
    if text == "-" or text.startswith("- "):
        return _parse_seq(prepared, idx, indent)
    return _parse_map(prepared, idx, indent)


def parse_document(text: str):
    prepared = _prepare(text)
    node, _idx = _parse_block(prepared, 0, -1)
    return node


def _is_upload_artifact(uses: str) -> bool:
    name = " ".join(uses.split()).split("@", 1)[0].strip()
    return name == UPLOAD_PREFIX or name.startswith(UPLOAD_PREFIX + "/")


def _retention_present(value: object) -> bool:
    if value is None or isinstance(value, (MapNode, SeqNode)):
        return False
    return str(value).strip() != ""


def _trigger_entries(on_node: object, on_line: int):
    if isinstance(on_node, str):
        yield on_node, on_line
    elif isinstance(on_node, SeqNode):
        for item in on_node:
            if isinstance(item, str):
                yield item, on_node.line
            elif isinstance(item, MapNode):
                for key in item:
                    yield str(key), item.key_lines.get(str(key), item.line)
    elif isinstance(on_node, MapNode):
        for key in on_node:
            yield str(key), on_node.key_lines.get(str(key), on_node.line)


def _walk_uploads(node: object, path: Path, errors: list[str]) -> None:
    if isinstance(node, MapNode):
        if "uses" in node:
            uses = node["uses"]
            line = node.key_lines.get("uses", node.line)
            if not isinstance(uses, str):
                errors.append(f"{path}:{line}: uses 값이 문자열이 아니라 업로드 단계를 확인하지 못했습니다")
            elif _is_upload_artifact(uses):
                step = node.get("name")
                label = step.strip() if isinstance(step, str) and step.strip() else uses.strip()
                with_node = node.get("with")
                if not isinstance(with_node, MapNode) or not _retention_present(with_node.get("retention-days")):
                    errors.append(
                        f"{path}:{line}: upload-artifact 단계 '{label}'에 retention-days가 없습니다"
                    )
                else:
                    raw = str(with_node["retention-days"]).strip()
                    if raw.lstrip("-").isdigit():
                        days = int(raw)
                        if not 1 <= days <= 90:
                            errors.append(
                                f"{path}:{with_node.key_lines.get('retention-days', line)}: "
                                f"retention-days={days} 값이 GitHub 허용 범위 1–90 밖입니다"
                            )
        for value in node.values():
            _walk_uploads(value, path, errors)
    elif isinstance(node, SeqNode):
        for item in node:
            _walk_uploads(item, path, errors)


def analyze(text: str, path: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    try:
        doc = parse_document(text)
    except YamlError as exc:
        line = f":{exc.line}" if exc.line else ""
        return [f"{path}{line}: {exc}"], []
    if not isinstance(doc, MapNode):
        return [f"{path}: 워크플로 루트가 매핑이 아닙니다"], []
    if "on" in doc:
        on_line = doc.key_lines.get("on", doc.line)
        for name, line in _trigger_entries(doc["on"], on_line):
            if str(name).strip().lower() in WARN_TRIGGERS:
                warnings.append(
                    f"{path}:{line}: 트리거 '{name}'는 자동 시작이라 경고합니다. 종료 코드는 바꾸지 않습니다."
                )
    _walk_uploads(doc, path, errors)
    return errors, warnings


def workflow_files(paths: list[Path]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            files.extend(sorted(path.glob("*.yml")))
            files.extend(sorted(path.glob("*.yaml")))
        else:
            files.append(path)
    return files


def check_paths(paths: list[Path]) -> int:
    files = workflow_files(paths)
    if not files:
        print("검사할 워크플로 YAML이 없습니다.", file=sys.stderr)
        return 1
    error_count = 0
    warning_count = 0
    for path in files:
        if not path.is_file():
            print(f"{path}: 파일이 없습니다", file=sys.stderr)
            error_count += 1
            continue
        text = path.read_text(encoding="utf-8")
        errors, warnings = analyze(text, path)
        for message in warnings:
            print(f"경고: {message}", file=sys.stderr)
        for message in errors:
            print(f"오류: {message}", file=sys.stderr)
        error_count += len(errors)
        warning_count += len(warnings)
    if error_count:
        print(
            f"실패: 워크플로 {len(files)}개, retention-days 오류 {error_count}개, 트리거 경고 {warning_count}개",
            file=sys.stderr,
        )
        return 1
    print(f"확인: 워크플로 {len(files)}개, retention-days 누락 없음, 트리거 경고 {warning_count}개")
    return 0


def _expect_failure(text: str, name: str) -> None:
    errors, _warnings = analyze(text, Path(name))
    if not errors:
        raise SystemExit(f"self-test: {name} 은 실패해야 합니다")


def _expect_warning(text: str, name: str, trigger: str) -> None:
    errors, warnings = analyze(text, Path(name))
    if errors:
        raise SystemExit(f"self-test: {name} 은 retention 오류 없이 경고만 나야 합니다: {errors}")
    if not any(trigger in message for message in warnings):
        raise SystemExit(f"self-test: {name} 에서 '{trigger}' 경고가 없습니다: {warnings}")


def _expect_clean(text: str, name: str) -> None:
    errors, warnings = analyze(text, Path(name))
    if errors or warnings:
        raise SystemExit(f"self-test: {name} 은 깨끗해야 합니다: {errors} {warnings}")


def run_self_test() -> int:
    clean = """
name: CI
on:
  workflow_dispatch:
jobs:
  e2e:
    steps:
      - name: Upload E2E failure artifacts
        if: failure()
        uses: actions/upload-artifact@v7
        with:
          name: tessra-e2e-artifacts
          path: |
            e2e/.artifacts/
          # push / pull_request / schedule 라는 단어는 주석이다
          include-hidden-files: true
          if-no-files-found: ignore
          retention-days: 7
"""
    _expect_clean(clean, "clean.yml")
    _expect_failure(clean.replace("          retention-days: 7\n", ""), "missing.yml")
    _expect_failure(clean.replace("retention-days: 7", "retention-days:"), "blank.yml")
    _expect_failure(clean.replace("retention-days: 7", "retention-days: 0"), "zero.yml")
    _expect_failure(
        """
on: workflow_dispatch
jobs:
  e2e:
    steps:
      - uses: actions/upload-artifact@v4
        with: { name: a }
""",
        "flow-missing.yml",
    )
    _expect_clean(
        """
on:
  workflow_dispatch:
jobs:
  e2e:
    steps:
      - uses: actions/upload-artifact@v4
        with: { name: a, retention-days: 7 }
""",
        "flow-ok.yml",
    )
    warned = clean.replace("workflow_dispatch:", "workflow_dispatch:\n  push:\n    branches:\n      - main")
    _expect_warning(warned, "push.yml", "push")
    _expect_warning("on: [pull_request, workflow_dispatch]\njobs: {}\n", "flow-on.yml", "pull_request")
    _expect_warning(
        "on:\n  schedule:\n    - cron: '0 0 * * 1'\n  workflow_dispatch:\njobs: {}\n",
        "schedule.yml",
        "schedule",
    )
    _expect_warning("on: push\njobs: {}\n", "scalar-on.yml", "push")
    errors, warnings = analyze(warned.replace("retention-days: 7", "retention-days:"), Path("both.yml"))
    if not errors or not warnings:
        raise SystemExit("self-test: 누락과 자동 트리거가 함께 있으면 오류와 경고가 모두 있어야 합니다")

    root = Path(__file__).resolve().parent.parent
    live = workflow_files([root / ".github" / "workflows"])
    if not live:
        raise SystemExit("self-test: 저장소 워크플로가 없습니다")
    for path in live:
        live_errors, live_warnings = analyze(path.read_text(encoding="utf-8"), path)
        if live_errors or live_warnings:
            raise SystemExit(f"self-test: 현재 워크플로는 깨끗해야 합니다: {live_errors} {live_warnings}")
    print(f"self-test: 픽스처와 저장소 워크플로 {len(live)}개를 확인했습니다")
    return 0


def main(argv: list[str]) -> int:
    if "--help" in argv or "-h" in argv:
        print(
            "사용법: python3 scripts/check-artifact-retention.py [워크플로.yml ...]\n"
            "       python3 scripts/check-artifact-retention.py --self-test\n"
            "인자가 없으면 .github/workflows 의 yml/yaml을 검사한다."
        )
        return 0
    if "--self-test" in argv:
        return run_self_test()
    if len(argv) > 1:
        return check_paths([Path(arg) for arg in argv[1:]])
    root = Path(__file__).resolve().parent.parent
    return check_paths([root / ".github" / "workflows"])


if __name__ == "__main__":
    sys.exit(main(sys.argv))
