# Script 실행 보안 경계

Tessra의 Pre-request / Test script는 요청 설정에 따라 실행된다. 사용자가 작성한 script는 현재 요청에서 실행할 수 있고, 가져온 컬렉션이나 OpenAPI 데이터에 포함된 script는 기본적으로 비활성화되며 실행 전에 사용자가 신뢰 처리를 해야 한다. 신뢰한 script도 API 요청을 대신 보내는 기능이므로 내용과 대상 URL을 확인해야 한다.

## 현재 실행 경계

script는 Node.js `vm`의 별도 JavaScript realm에서 동기 실행된다. VM에 전달되는 입력은 request, response, environment의 JSON 직렬화 데이터뿐이며, 실행 후에도 request 변경, environment 변경, log와 test 결과를 JSON 문자열로만 회수한다. 호스트 realm의 객체·함수·Error 인스턴스는 script에 전달하지 않는다.

`pm`, `env`, `request`, `response`, `test`, `expect`, `assert`, `console`은 realm 안에서 생성된 래퍼다. `pm.crypto`, Base64와 시간 유틸리티도 Node 내장 모듈을 노출하지 않는 realm 내부 구현이다. UUID는 실행마다 호스트의 CSPRNG로 미리 만든 **256개** pool에서 제공하며 한 script 실행에서 pool을 모두 소진하면 실패한다. VM의 문자열 기반 동적 코드 생성과 WebAssembly 코드는 비활성화되어 `eval`, `Function`과 생성자 체인을 통한 동적 컴파일을 사용할 수 없다. 내장 prototype도 실행 전에 고정한다.

실행은 동기 API 계약을 유지하면서 VM의 `afterEvaluate` microtask 정책을 사용한다. 따라서 script가 만든 Promise callback도 평가가 끝날 때 함께 처리되고 같은 timeout의 적용을 받는다. 이 정책은 Node.js VM 문서의 [microtaskMode 설명](https://nodejs.org/download/release/v22.21.0/docs/api/vm.html#vmcreatecontextcontextobject-options)에 따른다. Promise를 사용한 비동기 작업이 완료될 때까지 네트워크나 파일 이벤트를 기다리는 API는 제공하지 않는다. 처리되지 않은 Promise rejection은 VM realm 밖의 Node.js `unhandledRejection` 경계로 전파될 수 있으며, 이를 막기 위한 호스트 전역 listener는 다른 확장의 rejection 처리 정책을 바꿀 수 있어 사용하지 않는다. 따라서 script가 비동기 실패를 만들지 않거나 자체적으로 `catch`해야 한다.

이 경계는 실수로 Node API를 노출하는 것을 막고, script 데이터와 Tessra 호스트 상태를 분리한다. API 요청 전송, 파일 읽기, 프로세스 실행, 환경변수 읽기 같은 호스트 기능은 script API에 제공하지 않는다.

## 비교와 인코딩 호환성

`to.equal()`은 `Object.is` 의미를 유지한다 (`NaN`은 같고 `+0`과 `-0`은 다름). 배열 `to.include()`는 `includes` 의미를 유지해 `NaN`도 찾는다. `to.eql()`과 값이 지정된 `to.have.property()`는 prototype, 열거 가능한 문자열/symbol 속성, 배열 길이/빈 슬롯, Date, RegExp, Map/Set, typed array/ArrayBuffer, boxed primitive, Error 및 순환 참조를 비교한다. 서로 다른 Promise/WeakMap/WeakSet 같은 불투명 객체는 같다고 간주하지 않고 미지원 비교 오류를 낸다. 모든 JavaScript 객체에 대해 Node assertion과 완전히 같은 구현을 보장하는 계약은 아니다.

Base64 decode는 일반 공백과 tab/CR/LF를 제거하며, 잘못된 UTF-8은 Node Buffer와 같이 대체 문자로 처리한다. 호스트 Buffer/assert를 검증 기준으로만 사용하고 VM에는 전달하지 않는다. Microtask 완료는 큐 안의 완료 마커가 아니라 시간 제한이 있는 `runInContext`가 반환됐는지로 판단한다.

## 한계

Node.js `vm`은 OS 보안 샌드박스가 아니다. Tessra는 이 VM을 악성 코드 실행에 대한 완전한 격리 경계로 주장하지 않는다. VM 자체의 취약점이나 Node.js 런타임 결함, 메모리 고갈, 프로세스 수준의 자원 고갈까지 해결하지 않는다. 실행시간 제한은 동기 script 평가에 적용되지만, 메모리 사용량과 출력 크기를 별도로 보장하는 정책은 아니다.

더 높은 위험도의 script를 실행해야 하는 환경에서는 VM을 단독 보안 경계로 사용하지 말고, 별도 제한 프로세스와 OS 권한·파일시스템·네트워크 정책, 프로세스 자원 제한을 함께 적용해야 한다. 해당 격리 환경이 도입되기 전까지 Tessra의 script는 사용자가 직접 확인하고 신뢰한 로컬 자동화 용도로 취급한다.
