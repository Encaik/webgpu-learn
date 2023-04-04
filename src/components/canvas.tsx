import { useEffect, useRef } from "react";
import { createBuffer, initGpu } from "../utils/gpu";
import { dot } from "../utils/math";

const Canvas = () => {
  const canvas = useRef<HTMLCanvasElement>(null);
  let gpu: GPU | null = null;
  let ctx: GPUCanvasContext | null = null;
  let adapter: GPUAdapter | null = null;
  let device: GPUDevice | null = null;
  let format: GPUTextureFormat | null = null;

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
  let uniformData = new Float32Array([
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
    if(uniformData.at(12)!>=0.8) translateValue = -0.001
    if(uniformData.at(12)!<=0.2) translateValue = 0.001

    uniformData = dot(new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      translateValue, 0, 0, 1
    ]), uniformData)

    // rotate
    // angle += rotateValue;
    // uniformData[0] = Math.cos(angle);
    // uniformData[1] = -Math.sin(angle);
    // uniformData[4] = Math.sin(angle);
    // uniformData[5] = Math.cos(angle);

    // scale
    if (uniformData.at(0)! >= 0.8) scaleValue = 0.999
    if (uniformData.at(0)! <= 0.2) scaleValue = 1.001
    uniformData = dot(new Float32Array([
      scaleValue, 0, 0, 0,
      0, scaleValue, 0, 0,
      0, 0, scaleValue, 0,
      0, 0, 0, 1
    ]), uniformData)

    let vertexBuffer = createBuffer(device!, vertexData, GPUBufferUsage.VERTEX);
    let colorBuffer = createBuffer(device!, colorData, GPUBufferUsage.VERTEX);
    let indexBuffer = createBuffer(device!, indexData, GPUBufferUsage.INDEX);
    let uniformBuffer = createBuffer(device!, uniformData, GPUBufferUsage.UNIFORM);
    let commandEncoder = device?.createCommandEncoder();
    if (commandEncoder) {
      const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [{
          view: ctx!.getCurrentTexture().createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }
        }]
      }
      let renderPassEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
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
      renderPassEncoder.setBindGroup(0, uniformBindGroup!);
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
      renderPassEncoder.setPipeline(pipeline!);
      renderPassEncoder.setViewport(0, 0, canvas.current?.width!, canvas.current?.height!, 0, 1);
      renderPassEncoder.setVertexBuffer(0, vertexBuffer!);
      renderPassEncoder.setVertexBuffer(1, colorBuffer!);
      renderPassEncoder.setIndexBuffer(indexBuffer!, 'uint32');
      renderPassEncoder.drawIndexed(3);
      renderPassEncoder.end();
    }
    device?.queue.submit([commandEncoder!.finish()]);
    requestAnimationFrame(frame);
  }

  useEffect(() => {
    if (canvas.current) {
      initGpu(canvas.current).then((res) => {
        if (res) {
          ({ ctx, gpu, adapter, device, format } = res);
          frame();
        }
      });
    }
  }, [])

  return (
    <>
      <canvas ref={canvas} width='100%' height='100%'></canvas>
    </>
  )
}

export default Canvas;