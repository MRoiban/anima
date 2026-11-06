import '@anima-format/core/all';import {readFileSync}from'node:fs';import{load,Player,toSVG,drawFrame}from'@anima-format/core';
const doc=JSON.parse(readFileSync('spec/conformance/drawing-paint-paint-blend-override/case.ani','utf8'));
const f=doc.nodes[1];f.x=1;f.stroke.position='outside';f.stroke.join='miter';
const p=new Player(load(doc).model!);console.log(drawFrame(p).nodes[1]);console.log(toSVG(p));
