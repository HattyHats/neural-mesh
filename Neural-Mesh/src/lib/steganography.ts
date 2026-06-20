export async function createStegoImage(payload: string): Promise<string> {
  const width = 800;
  const height = 800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("No 2d context");

  // Draw procedural background
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#3b82f6');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Add some stars/dots
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5})`;
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 36px "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Neural-Mesh Snapshot', width / 2, height / 2 - 20);
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '16px "Inter", sans-serif';
  ctx.fillText('Drag & Drop this image into Neural-Mesh', width / 2, height / 2 + 20);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Force all alpha to 255 to prevent browser premultiplication issues
  for (let i = 3; i < data.length; i += 4) {
    data[i] = 255;
  }

  // Convert payload to bytes using UTF-8
  const enc = new TextEncoder();
  const bytes = enc.encode(payload);
  const length = bytes.length;

  if (length * 8 + 32 > width * height * 3) {
    throw new Error('Payload too large for this image size');
  }

  // Helper to set LSB
  let bitIndex = 0;
  const setNextBit = (bit: number) => {
    // We skip alpha channel
    const pixelIndex = Math.floor(bitIndex / 3) * 4;
    const channelOffset = bitIndex % 3;
    const dataIndex = pixelIndex + channelOffset;
    
    // Clear LSB and set it to `bit`
    data[dataIndex] = (data[dataIndex] & 0xFE) | bit;
    bitIndex++;
  };

  // 1. Encode 32-bit length
  for (let i = 0; i < 32; i++) {
    const bit = (length >> (31 - i)) & 1;
    setNextBit(bit);
  }

  // 2. Encode payload bytes
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    for (let j = 0; j < 8; j++) {
      const bit = (byte >> (7 - j)) & 1;
      setNextBit(bit);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function extractStegoImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const width = img.width;
      const height = img.height;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject("No 2d context");

      ctx.drawImage(img, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      let bitIndex = 0;
      const getNextBit = () => {
        const pixelIndex = Math.floor(bitIndex / 3) * 4;
        const channelOffset = bitIndex % 3;
        const dataIndex = pixelIndex + channelOffset;
        const bit = data[dataIndex] & 1;
        bitIndex++;
        return bit;
      };

      // 1. Read 32-bit length
      let length = 0;
      for (let i = 0; i < 32; i++) {
        length = (length << 1) | getNextBit();
      }

      if (length <= 0 || length > 5000000) {
        reject(new Error('No valid steganography data found'));
        return;
      }

      // 2. Read bytes
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        let byte = 0;
        for (let j = 0; j < 8; j++) {
          byte = (byte << 1) | getNextBit();
        }
        bytes[i] = byte;
      }

      const dec = new TextDecoder();
      resolve(dec.decode(bytes));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}
