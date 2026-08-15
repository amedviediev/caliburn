// Verbatim port of upstream `excalidraw-app/share/qrcode.chunk.ts` — kept as
// its own module so the QR generator stays a lazy chunk.
import { renderSVG } from "uqr";

export const generateQRCodeSVG = (text: string): string => {
  return renderSVG(text);
};
