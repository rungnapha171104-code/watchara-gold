export const MAX_WIDTH = 1200;

export function isHeic(f: File) {
  return /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
}

function decode(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("เบราว์เซอร์อ่านไฟล์ภาพนี้ไม่ได้")); };
    img.src = url;
  });
}

async function heicToJpeg(file: File): Promise<Blob> {
  // heic-to ใช้ libheif รุ่นใหม่ รองรับ HEIC จาก iPhone รุ่นปัจจุบัน (heic2any เก่าเกินไป)
  let mod: typeof import("heic-to/next");
  try {
    mod = await import("heic-to/next");
  } catch (e) {
    throw new Error("โหลดตัวแปลง HEIC ไม่สำเร็จ: " + (e as Error).message);
  }
  try {
    return await mod.heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
  } catch (e) {
    const err = e as { message?: string };
    throw new Error("แปลง HEIC ไม่สำเร็จ: " + (err.message ?? JSON.stringify(e)));
  }
}

/** ย่อรูป (กว้างไม่เกิน 1200px, quality 0.8) เพื่อลดขนาดอัปโหลดและเวลาประมวลผล AI */
export async function prepareFile(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;

  let img: HTMLImageElement;
  try {
    img = await decode(file);
  } catch (first) {
    if (!isHeic(file)) throw first;
    img = await decode(await heicToJpeg(file));
  }

  const scale = Math.min(1, MAX_WIDTH / img.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์ไม่รองรับ canvas");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const jpeg: Blob = await new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("แปลงรูปเป็น JPEG ไม่สำเร็จ"))), "image/jpeg", 0.8)
  );
  return new File([jpeg], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}
