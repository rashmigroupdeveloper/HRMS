/** BETA-01: one explicitly chosen frame; always stop screen sharing. */
export interface Screenshot {
  mime: 'image/png' | 'image/jpeg';
  base64: string;
}
export function readScreenshot(file: File, maxBytes: number): Promise<Screenshot> {
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > maxBytes || file.size === 0) {
    return Promise.reject(
      new Error(
        `Choose a PNG or JPEG screenshot smaller than ${(maxBytes / 1_000_000).toFixed(1)} MB.`,
      ),
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error('Could not read the screenshot. Try another image.'));
    };
    reader.onload = () => {
      resolve({
        mime: file.type as Screenshot['mime'],
        base64: typeof reader.result === 'string' ? reader.result.split(',')[1] ?? '' : '',
      });
    };
    reader.readAsDataURL(file);
  });
}
export async function captureScreenshot(): Promise<Screenshot> {
  const media = (navigator as Partial<Navigator>).mediaDevices as Partial<MediaDevices> | undefined;
  if (!media?.getDisplayMedia)
    throw new Error('Screen capture is unavailable here. Use Upload screenshot instead.');
  const stream = await media.getDisplayMedia({
    video: { displaySurface: 'browser' },
    audio: false,
  });
  const video = document.createElement('video');
  try {
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    // Let the drawer finish closing before sampling the explicitly selected tab.
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    if (!video.videoWidth || !video.videoHeight)
      throw new Error('No screenshot frame was available. Try uploading an image.');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1920 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Screenshot capture is unavailable. Upload an image instead.');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return { mime: 'image/jpeg', base64: canvas.toDataURL('image/jpeg', 0.82).split(',')[1] ?? '' };
  } finally {
    stream.getTracks().forEach((track) => {
      track.stop();
    });
    video.srcObject = null;
  }
}
