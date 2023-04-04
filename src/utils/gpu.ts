export const initGpu = async (canvas: HTMLCanvasElement) => {
  const gpu = navigator.gpu;
  if (!gpu) {
    console.log('不支持webgpu');
    return;
  }
  const adapter = await gpu.requestAdapter();
  const device = await adapter?.requestDevice() || null;
  if (!device) {
    console.log('没有显卡或相关设备')
    return
  }
  let width = document.body.clientWidth;
  let height = document.body.clientHeight;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('webgpu');
  const format = gpu.getPreferredCanvasFormat();
  ctx?.configure({
    device,
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    alphaMode: 'opaque'
  })
  return ({ ctx, gpu, adapter, device, format })
}

export const createBuffer = (device: GPUDevice, arr: Float32Array | Uint32Array, usage: GPUBufferUsageFlags) => {
  const buffer = device.createBuffer({
    size: arr.byteLength,
    usage: usage | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true
  });
  const constructor = arr.constructor as new (buffer: ArrayBuffer) => Float32Array | Uint32Array;
  if (buffer) {
    const view = new constructor(buffer.getMappedRange());
    view.set(arr, 0);
    buffer?.unmap();
  }
  return buffer;
}