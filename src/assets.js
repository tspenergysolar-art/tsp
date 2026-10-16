export async function prepareImage(file, kind) {
  if (!file || !['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Escolha uma imagem PNG, JPG ou WebP.');
  if (file.size > 5*1024*1024) throw new Error('Escolha uma imagem de até 5 MB.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('Não foi possível ler essa imagem.'); }
  try {
    if (bitmap.width < 24 || bitmap.height < 24 || bitmap.width * bitmap.height > 25000000) throw new Error('A imagem tem dimensões inválidas.');
    const scale = Math.min(1,640/Math.max(bitmap.width,bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width=Math.round(bitmap.width*scale); canvas.height=Math.round(bitmap.height*scale);
    const ctx=canvas.getContext('2d');
    ctx.imageSmoothingEnabled=kind!=='pixQr';
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const result=canvas.toDataURL(kind==='pixQr'?'image/png':'image/webp',0.85);
    if (result.length>90000) throw new Error('A imagem continua grande após o ajuste. Use um arquivo mais simples, com fundo limpo.');
    return result;
  } finally {bitmap.close();}
}
