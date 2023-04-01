import { useRef } from 'react';

function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  let ctx: GPUCanvasContext | null = null;
  let adapter: GPUAdapter | null = null;
  let device: GPUDevice | null = null;
  let format: GPUTextureFormat | null = null;

  const initGpu = async () => {
    const gpu: GPU = navigator.gpu;
    if (!gpu) {
      console.log('不支持webgpu');
      return;
    }
    adapter = await gpu.requestAdapter();
    device = await adapter?.requestDevice() || null;
    if (!device) {
      console.log('没有显卡或相关设备')
      return
    }
    let width = document.body.clientWidth;
    let height = document.body.clientHeight;
    if (canvas.current) {
      canvas.current.width = width;
      canvas.current.height = height;
      ctx = canvas.current.getContext('webgpu');
    }
    format = gpu.getPreferredCanvasFormat();
    ctx?.configure({
      device,
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      alphaMode: 'opaque'
    })
    const vertexData = new Float32Array([
      0.0, 1.0, 0.0,
      -1.0, -1.0, 0.0,
      1.0, -1.0, 0.0
    ]);
    const colorData = new Float32Array([
      0.98, 0.41, 0.46,
      0.96, 0.76, 0.42,
      0.97, 0.44, 0.75
    ]);
    const indexData = new Uint32Array([
      0,
      1,
      2
    ]);
    const uniformData = new Float32Array([
      1.0, 0.0, 0.0, 0.0, // x
      0.0, 1.0, 0.0, 0.0, // y
      0.0, 0.0, 1.0, 0.0, // z
      0.0, 0.0, 0.0, 1.0, // w
    ]);
    let scaleValue = -0.001;
    let translateValue = -0.001;
    let rotateValue = 0.001;
    let angle = 0;

    const frame = () => {
      // translate
      // uniformData[3]+=scaleValue
      // if(uniformData[3]>=0.8) translateValue = -0.001
      // if(uniformData[3]<=0.2) translateValue = 0.001
      // uniformData[7]+=scaleValue
      // if(uniformData[7]>=0.8) translateValue = -0.001
      // if(uniformData[7]<=0.2) translateValue = 0.001

      // rotate
      angle += rotateValue;
      uniformData[0] = Math.cos(angle);
      uniformData[1] = -Math.sin(angle);
      uniformData[4] = Math.sin(angle);
      uniformData[5] = Math.cos(angle);

      // scale
      // uniformData[0]+=scaleValue
      // if(uniformData[0]>=0.8) scaleValue = -0.001
      // if(uniformData[0]<=0.2) scaleValue = 0.001
      // uniformData[5]+=scaleValue
      // if(uniformData[5]>=0.8) scaleValue = -0.001
      // if(uniformData[5]<=0.2) scaleValue = 0.001

      const createBuffer = (arr: Float32Array | Uint32Array, usage: GPUBufferUsageFlags) => {
        const buffer = device?.createBuffer({
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
      let vertexBuffer = createBuffer(vertexData, GPUBufferUsage.VERTEX);
      let colorBuffer = createBuffer(colorData, GPUBufferUsage.VERTEX);
      let indexBuffer = createBuffer(indexData, GPUBufferUsage.INDEX);
      let uniformBuffer = createBuffer(uniformData, GPUBufferUsage.UNIFORM);
      let commandEncoder = device?.createCommandEncoder();
      let renderPassEncoder = commandEncoder?.beginRenderPass({
        colorAttachments: [{
          view: ctx?.getCurrentTexture().createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }
        }]
      } as GPURenderPassDescriptor);
      //创建绑定组布局
      let uniformBindGroupLayout = device?.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: {
              type: 'uniform'
            }
          }
        ]
      });
      //创建管线布局
      let layout = device?.createPipelineLayout({
        bindGroupLayouts: [uniformBindGroupLayout]
      } as GPUPipelineLayoutDescriptor);
      //创建绑定组
      let uniformBindGroup = device?.createBindGroup({
        layout: uniformBindGroupLayout,
        entries: [{
          binding: 0,
          resource: { buffer: uniformBuffer }
        }]
      } as GPUBindGroupDescriptor);
      renderPassEncoder?.setBindGroup(0, uniformBindGroup!);
      const pipeline = device?.createRenderPipeline({
        layout,
        vertex: {
          module: device.createShaderModule({
            code: `
@group(0) @binding(0) 
var<uniform> uniforms: mat4x4<f32>;

struct Output {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec3<f32>,
};

@vertex
fn main(@location(0) pos: vec3<f32>, @location(1) color: vec3<f32>) -> Output {
  var output: Output;
  output.position = uniforms * vec4<f32>(pos, 1.0);
  output.color = color;
  return output;
}
              `,
          }),
          entryPoint: 'main',
          buffers: [
            {
              attributes: [{
                shaderLocation: 0, // @location(0)
                offset: 0,
                format: 'float32x3'
              }],
              arrayStride: 4 * 3, // sizeof(float) * 3
              stepMode: 'vertex'
            },
            {
              attributes: [{
                shaderLocation: 1, // @location(1)
                offset: 0,
                format: 'float32x3'
              }],
              arrayStride: 4 * 3, // sizeof(float) * 3
              stepMode: 'vertex'
            }
          ]
        },
        fragment: {
          module: device.createShaderModule({
            code: `
@fragment
fn main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
  return vec4<f32>(color, 1.0);
}

              `,
          }),
          entryPoint: 'main',
          targets: [
            {
              format,
            },
          ],
        },
        primitive: {
          frontFace: 'cw',
          cullMode: 'none',
          topology: 'triangle-list'
        },
      } as GPURenderPipelineDescriptor);
      renderPassEncoder?.setPipeline(pipeline!);
      renderPassEncoder?.setViewport(0, 0, canvas.current?.width!, canvas.current?.height!, 0, 1);
      renderPassEncoder?.setVertexBuffer(0, vertexBuffer!);
      renderPassEncoder?.setVertexBuffer(1, colorBuffer!);
      renderPassEncoder?.setIndexBuffer(indexBuffer!, 'uint32');
      renderPassEncoder?.drawIndexed(3);
      renderPassEncoder?.end();
      device?.queue.submit([commandEncoder!.finish()]);
      requestAnimationFrame(frame);
    }

    frame();
  }

  initGpu();

  return (
    <>
      <canvas ref={canvas} width='100%' height='100%'></canvas>
    </>
  )
}

export default App
