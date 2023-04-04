export const dot = (a:Float32Array,b:Float32Array)=>{
  let e = new Float32Array(16)
  for (let i = 0; i < 4; i++) {
    const ai0=a[i];
    const ai1=a[i+4];
    const ai2=a[i+8]; 
    const ai3=a[i+12];
    e[i]    = ai0 * b[0]  + ai1 * b[1]  + ai2 * b[2]  + ai3 * b[3];
    e[i+4]  = ai0 * b[4]  + ai1 * b[5]  + ai2 * b[6]  + ai3 * b[7];
    e[i+8]  = ai0 * b[8]  + ai1 * b[9]  + ai2 * b[10] + ai3 * b[11];
    e[i+12] = ai0 * b[12] + ai1 * b[13] + ai2 * b[14] + ai3 * b[15];
  }
  return e;
}