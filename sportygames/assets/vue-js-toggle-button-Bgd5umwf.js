import{S as e,s as t,v as n}from"./runtime-core.esm-bundler-BxYmWHN0.js";var r=`#75c791`,i=`#bfcbd9`,a=`on`,o=`off`,s=`#fff`,c=e=>typeof e==`string`,l=e=>typeof e==`object`,u=(e,t)=>l(e)&&Object.prototype.hasOwnProperty.call(e,t),d=(e,t,n)=>u(e,t)?e[t]:n,f=e=>`${e}px`,p=(e,t)=>`translate(${e}, ${t})`,m=n({name:`ToggleButton`,props:{value:{type:Boolean,default:!1},modelValue:{type:Boolean,default:void 0},name:{type:String},disabled:{type:Boolean,default:!1},tag:{type:String},sync:{type:Boolean,default:!1},speed:{type:Number,default:300},color:{type:[String,Object],validator(e){return c(e)||u(e,`checked`)||u(e,`unchecked`)||u(e,`disabled`)}},switchColor:{type:[String,Object],validator(e){return c(e)||u(e,`checked`)||u(e,`unchecked`)}},cssColors:{type:Boolean,default:!1},labels:{type:[Boolean,Object],default:!1,validator(e){return typeof e==`object`?e.checked||e.unchecked:typeof e==`boolean`}},height:{type:Number,default:22},width:{type:Number,default:50},margin:{type:Number,default:3},fontSize:{type:Number}},emits:[`update:modelValue`,`change`,`input`],setup(n,{emit:c}){let u=t(()=>n.modelValue===void 0?n.value:n.modelValue),m=t(()=>[`vue-js-switch`,{toggled:u.value,disabled:n.disabled}]),h=t(()=>l(n.color)?d(n.color,`checked`,r):n.color||r),g=t(()=>d(n.color,`unchecked`,i)),_=t(()=>u.value?h.value:g.value),v=t(()=>d(n.color,`disabled`,_.value)),y=t(()=>({width:f(n.width),height:f(n.height),backgroundColor:n.cssColors?null:n.disabled?v.value:_.value,borderRadius:f(Math.round(n.height/2))})),b=t(()=>n.height-n.margin*2),x=t(()=>f(n.width-n.height+n.margin)),S=t(()=>d(n.switchColor,`checked`,s)),C=t(()=>d(n.switchColor,`unchecked`,s)),w=t(()=>l(n.switchColor)?u.value?S.value:C.value:n.switchColor||s),T=t(()=>{let e=`transform ${n.speed}ms`,t=f(n.margin),r=u.value?p(x.value,t):p(t,t),i=n.switchColor?w.value:null;return{width:f(b.value),height:f(b.value),transition:e,transform:r,background:i}}),E=t(()=>({lineHeight:f(n.height),fontSize:n.fontSize?f(n.fontSize):null})),D=t(()=>d(n.labels,`checked`,a)),O=t(()=>d(n.labels,`unchecked`,o)),k=e=>{if(n.disabled)return;let t=!u.value;c(`update:modelValue`,t),c(`input`,t),c(`change`,{value:t,tag:n.tag,srcEvent:e})};return()=>e(`label`,{class:m.value,tabindex:`0`,role:`checkbox`,onClick:e=>{},onKeydown:e=>{e.key===` `&&(e.preventDefault(),k(e))}},[e(`input`,{type:`checkbox`,class:`v-switch-input`,name:n.name,checked:u.value||void 0,disabled:n.disabled,tabindex:`-1`,onChange:e=>{e.stopPropagation(),k(e)}}),e(`div`,{class:`v-switch-core`,style:y.value},[e(`div`,{class:`v-switch-button`,style:T.value})]),n.labels?u.value?e(`span`,{class:`v-switch-label v-left`,style:E.value},D.value):e(`span`,{class:`v-switch-label v-right`,style:E.value},O.value):null,e(`style`,[`
            .vue-js-switch {
                display: inline-block;
                position: relative;
                vertical-align: middle;
                user-select: none;
                font-size: 10px;
                cursor: pointer;
                margin-bottom: 0.5rem;
            }
            .vue-js-switch .v-switch-input {
                opacity: 0;
                position: absolute;
                width: 1px;
                height: 1px;
            }
            .vue-js-switch .v-switch-label {
                position: absolute;
                top: 0;
                font-weight: 600;
                color: white;
                z-index: 1;
            }
            .vue-js-switch .v-switch-label.v-left {
                left: 10px;
            }
            .vue-js-switch .v-switch-label.v-right {
                right: 10px;
            }
            .vue-js-switch .v-switch-core {
                display: block;
                position: relative;
                box-sizing: border-box;
                outline: 0;
                margin: 0;
                transition: border-color 0.3s, background-color 0.3s;
                user-select: none;
            }
            .vue-js-switch .v-switch-core .v-switch-button {
                display: block;
                position: absolute;
                overflow: hidden;
                top: 0;
                left: 0;
                border-radius: 100%;
                background-color: #fff;
                z-index: 2;
            }
            .vue-js-switch.disabled {
                pointer-events: none;
                opacity: 0.6;
            }
            `])])}});export{m as t};