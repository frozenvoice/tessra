// Webview용 Body 변환 헬퍼 (hljs와 동일하게 IIFE로 번들)
import { BodyConversionService } from '../services/BodyConversionService';

(globalThis as any).TessraBodyConversion = {
  convert: BodyConversionService.convert.bind(BodyConversionService),
  supportsConversion: BodyConversionService.supportsConversion.bind(BodyConversionService),
  isBinaryTransition: BodyConversionService.isBinaryTransition.bind(BodyConversionService),
  hasContent: BodyConversionService.hasContent.bind(BodyConversionService),
};
