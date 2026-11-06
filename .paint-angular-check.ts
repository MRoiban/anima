import '@anima-format/core/all';
import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{renderCanvas}from'./modules/paint/oracle-canvas.ts';import{compare}from'./tools/oracle.ts';
const d=JSON.parse(readFileSync('tests/oracle/drawing-paint-gradient-angular/case.ani','utf8'));d.nodes[0].fill.x2=0;d.nodes[0].fill.y2=-20;
await renderCanvas(d,'',new URL('file:///tmp/negative-angle-anima.png'));
console.log(compare(readFileSync('/tmp/negative-angle-anima.png'),readFileSync('/tmp/negative-angle-native.png'),16));
