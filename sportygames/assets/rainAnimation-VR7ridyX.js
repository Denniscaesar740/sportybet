function e(){let e=new Map,t=null,n=``,r=t=>{if(e.has(t))return;let n=t.querySelector(`.rain-container`);n||(n=document.createElement(`div`),n.classList.add(`rain-container`),t.appendChild(n));let r=setInterval(()=>{if(n.childElementCount>=20)return;let e=document.createElement(`div`);e.innerHTML=`
        <svg xmlns="http://www.w3.org/2000/svg" width="5" height="18">
          <g>
            <g stroke="null" id="svg_11">
              <path stroke="#ffffff" fill="#ffffff" opacity="NaN" d="m2.25829,0.32799c-0.05207,-0.08424 -1.61417,14.10957 -1.62068,14.07799c0.00651,0.03159 -0.09763,1.63207 -0.10414,1.60049c0.00651,0.03159 0.42307,0.95818 0.42307,0.95818c0,0 0.62484,0.54754 0.62484,0.54754c0,0 0.88519,0 0.88519,0.04212c0,0.04212 0.57277,-0.04212 0.57277,0c0,0.04212 0.83312,-0.42118 0.82661,-0.45277c0.00651,0.03159 0.16272,-0.34748 0.15621,-0.37906c0.00651,0.03159 0.21479,-0.55807 0.21479,-0.55807c0,0 0,-0.25271 -0.00651,-0.28429c0.00651,0.03159 0.00651,-0.72654 0,-0.75813c0.00651,0.03159 -0.04556,-0.51595 -0.05207,-0.54754c0.00651,0.03159 -0.09763,-0.43172 -0.10414,-0.4633c0.00651,0.03159 -0.04556,-0.3896 -0.05207,-0.42118c0.00651,0.03159 -1.7118,-13.27774 -1.76387,-13.36197l0.00002,0z" id="svg_8" />
              <ellipse stroke="#ffffff" fill="#ffffff" cx="2.44053" cy="15.92395" id="svg_10" rx="1.84848" ry="2.00061" filter="url(#svg_10_blur)" />
            </g>
          </g>
          <defs>
            <filter id="svg_10_blur">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0" />
            </filter>
          </defs>
        </svg>
      `,e.classList.add(`rain-drop`);let t;do t=Math.random()*180;while(t>140||t<40);e.style.left=`${t}px`,e.style.top=`-10px`,e.style.animationDuration=Math.random()*1+4.5+`s`,n.appendChild(e),setTimeout(()=>{e.remove()},1500)},130);e.set(t,{intervalId:r,rainContainer:n})},i=t=>{let n=e.get(t);n&&(clearInterval(n.intervalId),n.rainContainer&&(n.rainContainer.querySelectorAll(`.rain-drop`).forEach(e=>e.remove()),n.rainContainer.remove()),e.delete(t))};return{startRainAnimationOnButton:r,stopRainOnButton:i,watchButtons:a=>{n=a;let o=()=>{let a=document.querySelectorAll(n),s=new Set;a.forEach(t=>{s.add(t),e.has(t)||r(t)}),e.forEach((e,t)=>{(!s.has(t)||!t.matches(n))&&i(t)}),t=requestAnimationFrame(o)};t||(t=requestAnimationFrame(o))},stopAllRain:()=>{e.forEach((e,t)=>{i(t)}),e.clear(),t&&(cancelAnimationFrame(t),t=null)}}}export{e as t};