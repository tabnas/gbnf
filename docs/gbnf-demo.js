(()=>{var ea=Object.create;var Xs=Object.defineProperty;var ta=Object.getOwnPropertyDescriptor;var na=Object.getOwnPropertyNames;var sa=Object.getPrototypeOf,ra=Object.prototype.hasOwnProperty;var xe=(e,t)=>()=>{try{return t||e((t={exports:{}}).exports,t),t.exports}catch(n){throw t=0,n}};var ia=(e,t,n,s)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of na(t))!ra.call(e,r)&&r!==n&&Xs(e,r,{get:()=>t[r],enumerable:!(s=ta(t,r))||s.enumerable});return e};var Hs=(e,t,n)=>(n=e!=null?ea(sa(e)):{},ia(t||!e||!e.__esModule?Xs(n,"default",{value:e,enumerable:!0}):n,e));var vt=xe(ge=>{"use strict";Object.defineProperty(ge,"__esModule",{value:!0});ge.asTin=ge.MAX_RULE_HISTORY=ge.STRING=ge.SKIP=ge.INSPECT=ge.EMPTY=ge.AFTER=ge.BEFORE=ge.CLOSE=ge.OPEN=void 0;ge.OPEN="o";ge.CLOSE="c";ge.BEFORE="b";ge.AFTER="a";ge.EMPTY="";ge.INSPECT=Symbol.for("nodejs.util.inspect.custom");ge.SKIP=Symbol.for("tabnas.SKIP");ge.STRING="string";ge.MAX_RULE_HISTORY=16;var aa=e=>e;ge.asTin=aa});var qt=xe(X=>{"use strict";Object.defineProperty(X,"__esModule",{value:!0});X.STATE_MASK=X.STOP=X.CI_RESET=X.IS_ROW=X.CONSUME=X.makeTextMatcher=X.makeNumberMatcher=X.makeCommentMatcher=X.makeStringMatcher=X.makeLineMatcher=X.makeSpaceMatcher=X.makeFixedMatcher=X.makeMatchMatcher=X.makeToken=X.makePoint=X.makeLex=X.makeNoToken=X.Token=X.Point=X.Lex=void 0;X.guardedMatcher=lt;X.scan=Tt;X.buildCharRunSpec=Zs;X.buildLineRunSpec=ns;X.buildStringBodySpec=Qn;var at=vt(),W=St(),hn=class{constructor(t,n,s,r){this.len=-1,this.sI=0,this.rI=1,this.cI=1,this.token=[],this.len=t,n!=null&&(this.sI=n),s!=null&&(this.rI=s),r!=null&&(this.cI=r)}toString(){return"Point["+[this.sI+"/"+this.len,this.rI,this.cI]+(0<this.token.length?" "+this.token:"")+"]"}[at.INSPECT](){return this.toString()}};X.Point=hn;var dn=(...e)=>new hn(...e);X.makePoint=dn;var pn=class{#e;#t;constructor(t,n,s,r,i,a,o,l,c){this.isToken=!0,this.name=at.EMPTY,this.tin=-1,this.val=void 0,this.sI=-1,this.rI=-1,this.cI=-1,this.len=-1,this.name=t,this.tin=n,this.#e=r,this.#t=l,this.val=s,this.sI=i.sI,this.rI=i.rI,this.cI=i.cI,this.use=a,this.why=o,this.len=c??(r==null?0:r.length)}get src(){let t=this.#e;if(t===void 0){let n=this.#t;t=this.#e=n===void 0?at.EMPTY:n.substring(this.sI,this.sI+this.len)}return t}set src(t){this.#e=t}resolveVal(t,n){return typeof this.val=="function"?this.val(t,n):this.val}bad(t,n){return this.err=t,n!=null&&(this.use=(0,W.deep)(this.use||{},n)),this}toString(){return"Token["+this.name+"="+this.tin+" "+(0,W.snip)(this.src)+(this.val===void 0||this.name==="#ST"||this.name==="#TX"?"":"="+(0,W.snip)(this.val))+" "+[this.sI,this.rI,this.cI]+(this.use==null?"":" "+(0,W.snip)(""+JSON.stringify(this.use).replace(/"/g,""),22))+(this.err==null?"":" "+this.err)+(this.why==null?"":" "+(0,W.snip)(""+this.why,22))+"]"}[at.INSPECT](){return this.toString()}};X.Token=pn;var es=(...e)=>new pn(...e);X.makeToken=es;var oa=()=>es("",-1,void 0,at.EMPTY,dn(-1));X.makeNoToken=oa;function lt(e,t){return function(s,r,i){if(e.lex){if(e.check){s.refwd();let a=e.check(s);if(a&&a.done)return a.token}return t(s,r,i)}}}var ot=65536;X.CONSUME=ot;var gn=1<<17;X.IS_ROW=gn;var ts=1<<18;X.CI_RESET=ts;var Bt=1<<19;X.STOP=Bt;var Ws=65535;X.STATE_MASK=Ws;function Tt(e,t,n,s,r,i){let a=t,o=n,l=s,c=e.length,f=r.nclasses,u=r.classOf,h=r.table,d=r.initialState;for(;a<c;){let p=e.charCodeAt(a),b=p<256?u[p]:r.fallback(e[a]),m=h[d*f+b];if(m&ot&&(a++,m&gn?(o++,l=1):m&ts?l=1:l++),d=m&Ws,m&Bt)break}return i.sI=a,i.rI=o,i.cI=l,t<a}function ns(e){let t=new Uint8Array(256);for(let i=0;i<256;i++)e.charsBitmap[i]&&(t[i]=e.rowCharsBitmap[i]?2:1);let n=e.chars,s=e.rowChars;return{initialState:0,nclasses:3,classOf:t,fallback:i=>n[i]?s[i]?2:1:0,table:la}}var la=new Int32Array([Bt,ot,ot|gn]);function Zs(e,t){return{initialState:0,nclasses:2,classOf:e,fallback:s=>t[s]?1:0,table:ca}}var ca=new Int32Array([Bt,ot]);function Qn(e,t){let n=t.charCodeAt(0),s=e.string.escCharCode,r=e.string.replaceCodeMap,i=e.string.hasReplace,a=!!e.string.multiBitmap[n],o=e.string.allowControl,l=e.line.charsBitmap,c=e.line.rowCharsBitmap,f=new Uint8Array(256);for(let p=0;p<256;p++)p===n||p===s||i&&r[p]!==void 0?f[p]=1:a&&l[p]?f[p]=c[p]?3:2:p<32&&(o&&!l[p]?f[p]=0:f[p]=1);let u=e.line.chars,h=e.line.rowChars;return{initialState:0,nclasses:4,classOf:f,fallback:p=>{let b=p.charCodeAt(0);return p===t||b===s||i&&r[b]!==void 0?1:a&&u[p]?h[p]?3:2:0},table:fa}}var fa=new Int32Array([ot,Bt,ot|ts,ot|gn]),ua=(e,t)=>{let n=new Array(256),s=[],r=(i,a)=>a.len-i.len||(i.src<a.src?-1:i.src>a.src?1:0);for(let i of(0,W.keys)(e.fixed.token)){let a=e.fixed.token[i];if(a==null||i.length===0)continue;let o={src:i,len:i.length,tin:a},l=i.charCodeAt(0);l<256?(n[l]=n[l]||[]).push(o):s.push(o)}for(let i of n)i&&i.sort(r);return s.sort(r),lt(e.fixed,function(a){let o=a.pnt,l=a.src,c=l.charCodeAt(o.sI),f=c<256?n[c]:s;if(f===void 0)return;let u=a.want;for(let h of f)if(!(u!=null&&!u.includes(h.tin))&&(h.len===1&&c<256||l.startsWith(h.src,o.sI))){let d=a.token(h.tin,void 0,h.src,o);return o.sI+=h.len,o.cI+=h.len,d}})};X.makeFixedMatcher=ua;var ha=(e,t)=>{let n=(0,W.entries)(e.match.value).sort(([r],[i])=>r<i?-1:r>i?1:0).map(([,r])=>r),s=(0,W.values)(e.match.token).sort((r,i)=>(r.tin$||0)-(i.tin$||0));return n.length===0&&s.length===0?null:lt(e.match,function(i,a,o=0){let l=i.pnt,c=i.refwd(),f=a?.spec,u=f!=null,h=u&&a.state==="o"?0:1,d=i.want;if(d==null)for(let w of n)if(w.match instanceof RegExp){let g=c.match(w.match);if(g){let y=g[0],_=y.length;if(0<_){let v,x=w.val?w.val(g):y;return v=i.token("#VL",x,y,l),l.sI+=_,l.cI+=_,v}}}else{let g=w.match(i,a);if(g!=null)return g}let p=d==null&&u?f.def.tcol[h][o]:void 0,b=-1,m=()=>{if(b!==-1||(b=0,!e.fixed.lex||p==null||p.length===0))return b;let w=i.src,g=l.sI,y=e.fixed.token;for(let _ of(0,W.keys)(y)){let v=y[_];v!=null&&_.length>b&&p.includes(v)&&w.startsWith(_,g)&&(b=_.length)}return b};for(let w=0;w<2;w++){for(let g of s){let y=g.tin$;if(d!=null){if(!y||!d.includes(y))continue}else{let _=!y||!u||p!=null&&p.includes(y);if(w===0?!_:_||!g.eager$)continue}if(g instanceof RegExp){let _=c.match(g);if(_){let v=_[0],x=v.length;if(w===1&&x<=m())continue;if(0<x){let S;return S=i.token(y,v,v,l),l.sI+=x,l.cI+=x,S}}}else{let _=g(i,a);if(_!=null)return _}}if(d!=null)break}})};X.makeMatchMatcher=ha;var da=(e,t)=>{let n=t.comment;e.comment={lex:n?!!n.lex:!1,def:(n?.def?(0,W.entries)(n.def):[]).reduce((l,[c,f])=>{if(f==null||f===!1)return l;let{suffixes:u,suffixFn:h}=pa(f.suffix),d={name:c,start:f.start,end:f.end,line:!!f.line,lex:!!f.lex,eatline:!!f.eatline,suffixes:u,suffixFn:h};return l[c]=d,l},{}),check:n?.check};let s=(l,c)=>c.start.length-l.start.length||(l.name<c.name?-1:l.name>c.name?1:0),r=e.comment.lex?(0,W.values)(e.comment.def).filter(l=>l.lex&&l.line).sort(s):[],i=e.comment.lex?(0,W.values)(e.comment.def).filter(l=>l.lex&&!l.line).sort(s):[],a=ns(e.line),o={sI:0,rI:0,cI:0};return lt(e.comment,function(c){let f=c.pnt,u=c.src,h=f.rI,d=f.cI,p=e.line.charsBitmap,b=e.line.rowCharsBitmap,m=e.line.chars,w=e.line.rowChars;for(let g of r)if(u.startsWith(g.start,f.sI)){let y=u.length,_=f.sI+g.start.length;d+=g.start.length;let v=0,x;for(;_<y&&!((x=u.charCodeAt(_))<256?p[x]:m[u[_]]);){let O=Ys(u,_,g.suffixes);if(O>0){v=O;break}if(O=zs(c,_,g.suffixFn),O>0){v=O;break}d++,_++}v>0?(_+=v,d+=v):g.eatline&&(Tt(u,_,h,d,a,o),h=o.rI,_=o.sI);let S=c.token("#CM",void 0,void 0,f,void 0,void 0,_-f.sI);return f.sI=_,f.cI=d,f.rI=h,S}for(let g of i)if(u.startsWith(g.start,f.sI)){let y=u.length,_=f.sI+g.start.length,v=g.end;d+=g.start.length;let x=0,S;for(;_<y&&!u.startsWith(v,_);){let O=Ys(u,_,g.suffixes);if(O>0){x=O;break}if(O=zs(c,_,g.suffixFn),O>0){x=O;break}S=u.charCodeAt(_),(S<256?b[S]:w[u[_]])&&(h++,d=0),d++,_++}if(x>0){for(let $=0;$<x;$++)S=u.charCodeAt(_+$),(S<256?b[S]:w[u[_+$]])&&(h++,d=0),d++;let O=c.token("#CM",void 0,void 0,f,void 0,void 0,_+x-f.sI);return f.sI=_+x,f.rI=h,f.cI=d,O}if(u.startsWith(v,_)){d+=v.length,g.eatline&&(Tt(u,_,h,d,a,o),h=o.rI,_=o.sI);let O=c.token("#CM",void 0,void 0,f,void 0,void 0,_+v.length-f.sI);return f.sI=_+v.length,f.rI=h,f.cI=d,O}else return c.bad(W.S.unterminated_comment,f.sI,f.sI+9*g.start.length)}})};X.makeCommentMatcher=da;function pa(e){if(e==null)return{suffixes:void 0,suffixFn:void 0};if(typeof e=="function")return{suffixes:void 0,suffixFn:e};let t=[];if(typeof e=="string")e!==""&&t.push(e);else if(Array.isArray(e))for(let n of e)typeof n=="string"&&n!==""&&t.push(n);return t.length>1&&t.sort((n,s)=>s.length-n.length||(n<s?-1:n>s?1:0)),{suffixes:t.length===0?void 0:t,suffixFn:void 0}}function Ys(e,t,n){if(!n||n.length===0)return 0;for(let s of n)if(e.startsWith(s,t))return s.length;return 0}function zs(e,t,n){if(!n)return 0;let s=e.pnt,r=s.sI,i=s.rI,a=s.cI;s.sI=t;let o;try{o=n(e,void 0)}finally{s.sI=r,s.rI=i,s.cI=a}return o==null?0:typeof o.src=="string"?o.src.length:0}var ma=(e,t)=>{let n=(0,W.regexp)(e.line.lex?"y":"ys","(.*?)",...e.rePart.ender);return function(r){if(e.text.check){r.refwd();let u=e.text.check(r);if(u&&u.done)return u.token}let i=e.text,a=r.pnt,o=e.value.def,l=e.value.defre,c=a.sI;n.lastIndex=a.sI;let f=n.exec(r.src);if(f){let u=f[1],h=f[2],d;if(u!=null){let p=u.length;if(0<p){let b;if(e.value.lex){if((b=o[u])!==void 0)d=r.token("#VL",b.val,u,a),a.sI+=p,a.cI+=p;else for(let m of l)if(m.match){let w=m.match.exec(m.consume?r.refwd():u);if(w&&(m.consume||w[0].length===u.length)){let g=w[0];if(m.val==null)d=r.token("#VL",g,g,a);else{let y=typeof m.val=="function"?m.val(w):m.val;d=r.token("#VL",y,g,a)}a.sI+=g.length,a.cI+=g.length}}}d==null&&i.lex&&(d=r.token("#TX",u,u,a),a.sI+=p,a.cI+=p)}}if(d&&a.sI===c+(u==null?0:u.length)&&(d=Js(r,d,h)),d&&0<e.text.modify.length){let p=e.text.modify;for(let b=0;b<p.length;b++)d.val=p[b](d.val,r,e,t)}return d}}};X.makeTextMatcher=ma;var ga=(e,t)=>{let n=e.number,s=[n.hex?"[xX][0-9a-fA-F_]+":null,n.oct?"[oO][0-7_]+":null,n.bin?"[bB][01_]+":null].filter(l=>l!=null).join("|"),r="\\.?[0-9]+(?:[0-9_]*[0-9])?(?:\\.(?:[0-9](?:[0-9_]*[0-9])?)?)?(?:[eE][-+]?[0-9]+(?:[0-9_]*[0-9])?)?",i=(0,W.regexp)("y",("([-+]?"+(s===""?r:"(?:0(?:"+s+")|"+r+")")).replace(/_/g,n.sep?(0,W.escre)(n.sepChar):""),")",...e.rePart.ender),a=n.sep?(0,W.regexp)("g",(0,W.escre)(n.sepChar)):void 0,o=n.sep?n.sepChar:void 0;return lt(e.number,function(c){n=e.number;let f=c.pnt,u=e.value.def;i.lastIndex=f.sI;let h=i.exec(c.src);if(h){let d=h[1],p=h[2],b,m=!0;if(d!=null&&(m=!e.number.exclude||!d.match(e.number.exclude))){let w=d.length;if(0<w){let g;if(e.value.lex&&(g=u[d])!==void 0)b=c.token("#VL",g.val,d,f);else{let y=a&&o&&-1<d.indexOf(o)?d.replace(a,""):d,_=+y;if(isNaN(_)){let v=y[0];(v==="-"||v==="+")&&(_=(v==="-"?-1:1)*+y.substring(1))}isNaN(_)||(b=c.token("#NR",_,d,f),f.sI+=w,f.cI+=w)}}}return m&&b!=null&&(b=Js(c,b,p)),b}})};X.makeNumberMatcher=ga;var ba=/^[0-9a-fA-F]{2}$/,ka=/^[0-9a-fA-F]{4}$/,wa=(e,t)=>{let n=t.string||{};e.string=e.string||{},e.string.quoteMap=(0,W.charset)(n.chars),e.string.quoteBitmap=(0,W.charsBitmap)(n.chars),e.string.multiChars=(0,W.charset)(n.multiChars),e.string.multiBitmap=(0,W.charsBitmap)(n.multiChars),e.string.escMap={...n.escape},e.string.replaceCodeMap=(0,W.omap)((0,W.clean)({...n.replace}),([i,a])=>[i.charCodeAt(0),a]),e.string=(0,W.deep)(e.string,{lex:!!n?.lex,escChar:n.escapeChar,escCharCode:n.escapeChar==null?void 0:n.escapeChar.charCodeAt(0),allowUnknown:!!n.allowUnknown,escapeStrict:!!n.escapeStrict,allowControl:!!n.allowControl,hasReplace:!1,abandon:!!n.abandon}),e.string.check=n.check,e.string.escMap=(0,W.clean)(e.string.escMap);for(let i of(0,W.keys)(e.string.escMap))e.string.escMap[i]===""&&delete e.string.escMap[i];e.string.escBitmap=(0,W.charsBitmap)(e.string.escMap),e.string.hasReplace=0<(0,W.keys)(e.string.replaceCodeMap).length;let s=new Map;for(let i of Object.keys(e.string.quoteMap))s.set(i.charCodeAt(0),Qn(e,i));let r={sI:0,rI:0,cI:0};return lt(e.string,function(a){let o=e.string,{quoteMap:l,quoteBitmap:c,escMap:f,escCharCode:u,multiChars:h,multiBitmap:d,allowUnknown:p,replaceCodeMap:b,hasReplace:m,escapeStrict:w}=o,{pnt:g,src:y}=a,_=g.sI,v=g.rI,x=y.length,S=y.charCodeAt(_);if(!(S<256?c[S]:l[y[_]]))return;let O=y[_],$=S<256?!!d[S]:!!h[O],ee=s.get(S)||(()=>{let V=Qn(e,O);return s.set(S,V),V})(),I=_+1,q=v,j=g.cI+1,C;for(;I<x;){let V=I;if(Tt(y,I,q,j,ee,r),I=r.sI,q=r.rI,j=r.cI,C!==void 0&&V<I&&C.push(y.substring(V,I)),I>=x)break;let H=y.charCodeAt(I);if(H===S){let K=C===void 0?y.substring(_+1,I):C.join(at.EMPTY);I++;let re=a.token("#ST",K,void 0,g,void 0,void 0,I-_);return g.sI=I,g.rI=q,g.cI=j+1,re}if(m){let K=b[H];if(K!==void 0){C===void 0&&(C=_+1<I?[y.substring(_+1,I)]:[]),C.push(K),I++,j++;continue}}if(H===u){if(C===void 0&&(C=_+1<I?[y.substring(_+1,I)]:[]),I++,j++,I>=x)break;let K=y[I],re=f[K];if(re!=null)C.push(re),I++,j++;else if(K==="x"&&!w){I++;let Z=y.substring(I,I+2),he=ba.test(Z)?parseInt(Z,16):NaN;if(isNaN(he))return o.abandon?void 0:(I-=2,j-=1,g.sI=I,g.cI=j,a.bad(W.S.invalid_ascii,I,I+4));C.push(String.fromCharCode(he)),I+=2,j+=3}else if(K==="u")if(I++,y[I]==="{"&&!w){let Z=y.indexOf("}",I+1),he=Z===-1?"":y.substring(I+1,Z),ve=0<he.length&&he.length<=6&&/^[0-9a-fA-F]+$/.test(he)?parseInt(he,16):NaN;if(isNaN(ve)||1114111<ve)return o.abandon?void 0:(I=I-2,g.sI=I,g.cI=j-1,a.bad(W.S.invalid_unicode,I,Z===-1?x:Z+1));C.push(String.fromCodePoint(ve)),j+=Z+1-I+1,I=Z+1}else{let Z=y.substring(I,I+4),he=ka.test(Z)?parseInt(Z,16):NaN;if(isNaN(he))return o.abandon?void 0:(I=I-2,j-=1,g.sI=I,g.cI=j,a.bad(W.S.invalid_unicode,I,I+6));C.push(String.fromCharCode(he)),I+=4,j+=5}else if(p)C.push(K),I++,j++;else return o.abandon?void 0:(g.sI=I,g.cI=j,a.bad(W.S.unexpected,I,I+1));continue}if(H<32)return o.abandon?void 0:(g.sI=I,g.cI=j,a.bad(W.S.unprintable,I,I+1));break}if(!o.abandon)return g.rI=v,a.bad(W.S.unterminated_string,_,I)})};X.makeStringMatcher=wa;var ya=(e,t)=>{let n=ns(e.line),s={sI:0,rI:0,cI:0};return lt(e.line,function(i){let{pnt:a,src:o}=i;if(e.line.single){let l=e.line.charsBitmap,c=e.line.rowCharsBitmap,f=e.line.chars,u=e.line.rowChars,h=a.sI,d=a.rI,p,b={};for(;(p=o.charCodeAt(h))<256?l[p]:f[o[h]];){let m=o[h],w=(b[m]||0)+1;if(b[m]=w,w>1)break;(p<256?c[p]:u[o[h]])&&d++,h++}if(a.sI<h){let m=i.token("#LN",void 0,void 0,a,void 0,void 0,h-a.sI);return a.sI=h,a.rI=d,a.cI=1,m}return}if(Tt(o,a.sI,a.rI,a.cI,n,s)){let l=i.token("#LN",void 0,void 0,a,void 0,void 0,s.sI-a.sI);return a.sI=s.sI,a.rI=s.rI,a.cI=1,l}})};X.makeLineMatcher=ya;var xa=(e,t)=>{let n=Zs(e.space.charsBitmap,e.space.chars),s={sI:0,rI:0,cI:0};return lt(e.space,function(i){let{pnt:a,src:o}=i;if(Tt(o,a.sI,a.rI,a.cI,n,s)){let l=i.token("#SP",void 0,void 0,a,void 0,void 0,s.sI-a.sI);return a.sI=s.sI,a.rI=s.rI,a.cI=s.cI,l}})};X.makeSpaceMatcher=xa;function Js(e,t,n){let s=e.pnt,r=t;if(e.cfg.fixed.lex&&n!=null&&0<n.length){let a,o=e.cfg.fixed.token[n];o!=null&&(a=e.token(o,void 0,n,s)),a!=null&&(s.sI+=a.src.length,s.cI+=a.src.length,t==null?r=a:s.token.push(a))}return r}var Vs={match:1,fixed:1,space:1,line:1,string:1,comment:1,number:1,text:1},mn=class{refwd(){return this.fwdSI!==this.pnt.sI&&(this.fwd=this.src.substring(this.pnt.sI),this.fwdSI=this.pnt.sI),this.fwd}relex(t,n,s){if(t==null||t.len<=0||t.sI<0)return;let r=this.pnt,i=r.sI,a=r.rI,o=r.cI,l=r.token,c=r.end;r.sI=t.sI,r.rI=t.rI,r.cI=t.cI,r.token=[],r.end=void 0,this.want=n;let f;try{f=this.next(s)}finally{this.want=null}if(f==null||!n.includes(f.tin)){r.sI=i,r.rI=a,r.cI=o,r.token=l,r.end=c;return}t.ignored!=null&&(f.ignored=t.ignored);let u=this.relexUndo;return u.sI=i,u.rI=a,u.cI=o,u.token=l,u.end=c,f}unrelex(t,n,s,r,i){let a=this.pnt;a.sI=t,a.rI=n,a.cI=s,a.token=r,a.end=i}speculate(t,n,s){let r=this.pnt,i=r.sI,a=r.rI,o=r.cI,l=r.token.length,c=r.end;Vs[t.matcher]===void 0&&this.refwd();let f=t(this,n,s);if(f!=null&&this.want.includes(f.tin))return f;r.sI=i,r.rI=a,r.cI=o,r.token.length=l,r.end=c}constructor(t){this.src=at.EMPTY,this.ctx={},this.cfg={},this.pnt=dn(-1),this.fwd=at.EMPTY,this.fwdSI=-1,this.want=null,this.relexUndo={sI:-1,rI:-1,cI:-1,token:[],end:void 0},this.ctx=t,this.src=t.src(),this.cfg=t.cfg,this.pnt=dn(this.src.length)}token(t,n,s,r,i,a,o){let l,c;return typeof t=="string"?(c=t,l=(0,W.tokenize)(c,this.cfg)):(l=t,c=(0,W.tokenize)(t,this.cfg)),es(c,l,n,s,r||this.pnt,i,a,this.src,o)}next(t,n,s,r){let i,a=this.pnt,o=a.sI,l;if(a.end)i=a.end;else if(0<a.token.length)i=a.token.shift();else if(a.len<=a.sI)a.end=this.token("#ZZ",void 0,"",a),i=a.end;else{let c=this.cfg.lex.dispatch,f=this.src.charCodeAt(a.sI),u=c===void 0?this.cfg.lex.match:c[f<256?f:256];try{for(let h of u){if(this.want!=null){let d=h.matcher;if(d!=="match"&&d!=="fixed"){let p=this.cfg.t,b=d==="space"?p.SP:d==="line"?p.LN:d==="string"?p.ST:d==="comment"?p.CM:d==="number"?p.NR:d==="text"?p.TX:-1;if(b===-1){let m=this.speculate(h,t,r);if(m===void 0)continue;i=m,l=h;break}if(!this.want.includes(b))continue}}if(Vs[h.matcher]===void 0&&this.refwd(),i=h(this,t,r)){l=h;break}}}catch(h){i=i||this.token("#BD",void 0,this.src[a.sI],a,{err:h},h.code||W.S.unexpected)}i=i||this.token("#BD",void 0,this.src[a.sI],a,void 0,W.S.unexpected)}return this.ctx.log&&this.ctx.log(W.S.lex,this.ctx,t,this,a,o,l,i,n,s,r),this.ctx.sub.lex&&this.ctx.sub.lex.map(c=>c(i,t,this.ctx)),i}tokenize(t){return(0,W.tokenize)(t,this.cfg)}bad(t,n,s){return this.token("#BD",void 0,0<=n&&n<=s?this.src.substring(n,s):this.src[this.pnt.sI],void 0,void 0,t)}};X.Lex=mn;var va=(...e)=>new mn(...e);X.makeLex=va});var Gt=xe(De=>{"use strict";Object.defineProperty(De,"__esModule",{value:!0});De.TabnasError=void 0;De.errdesc=nr;De.errinject=er;De.errsite=rs;De.errmsg=tr;De.trimstk=Sa;De.strinject=sr;De.prop=rr;var pe=vt(),kn=St(),bn={function:"function",object:"object",string:"string",unexpected:"unexpected",Object:"Object",Array:"Array",gap:"  ",no_re_flags:pe.EMPTY},ss=class extends SyntaxError{constructor(t,n,s,r,i){n=(0,kn.deep)({},n);let a=nr(t,n,s,r,i);super(a.message),(0,kn.assign)(this,a),Object.defineProperty(this,"internal",{value:{token:s,rule:r,ctx:i},enumerable:!1});try{let o=i?.errs;Array.isArray(o)&&o.push(this)}catch{}}toJSON(){let t={status:"failure",code:pe.STRING===typeof this.code?this.code:"unknown",message:pe.EMPTY,hint:pe.EMPTY,row:1,col:1,pos:0,len:0,rule:pe.EMPTY,ruleStack:[],token:{name:pe.EMPTY,src:pe.EMPTY},expected:[],src:pe.EMPTY,plugins:[],version:pe.EMPTY};try{let n=bn.function===typeof this.txts?this.txts():void 0;n&&typeof n.msg=="string"&&(t.message=n.msg),n&&typeof n.hint=="string"&&(t.hint=n.hint.split(`
`).map(s=>bn.gap===s.substring(0,2)?s.substring(2):s).join(`
`).trim())}catch{}try{let n=this.internal,s=n?.token,r=n?.ctx;if(s!=null){t.row=1<=s.rI?s.rI:1,t.col=1<=s.cI?s.cI:1,t.pos=0<=s.sI?s.sI:0;let f=pe.STRING===typeof s.src?s.src:pe.EMPTY;t.len=Array.from(f).length,t.token={name:pe.STRING===typeof s.name?s.name:pe.EMPTY,src:f}}let i=f=>f!=null&&f!==r?.NORULE&&pe.STRING===typeof f.name&&pe.EMPTY!==f.name,a=n?.rule;i(a)||(a=r?.rule),i(a)||(a=void 0),a!=null&&(t.rule=a.name);let o=[];if(r!=null&&Array.isArray(r.rs)&&typeof r.rsI=="number")for(let f of r.rs.slice(0,Math.max(0,r.rsI)))i(f)&&o.push(f.name);a!=null&&o.push(a.name),t.ruleStack=o;let l=a?.spec?.def?.tcol;if(l!=null&&r?.cfg!=null){let f=l[pe.OPEN===a.state?0:1]?.[0]??[];t.expected=[...new Set(f.map(u=>""+(0,kn.tokenize)(u,r.cfg)))].sort()}let c=bn.function===typeof r?.src?r.src():void 0;if(pe.STRING===typeof c){let f=c.split(`
`)[t.row-1];f!==void 0&&(t.src=f.endsWith("\r")?f.substring(0,f.length-1):f)}bn.function===typeof r?.plgn&&(t.plugins=r.plgn().map(f=>""+f?.name))}catch{}try{t.version=_t().VERSION}catch{}return t}};De.TabnasError=ss;function er(e,t,n,s,r,i){let a={...i||{},...i.cfg||{},...i.opts||{},...s||{},...s==null?{}:{src:s.src},...r||{},...i.meta||{},...n||{},code:t,details:n,token:s,rule:r,ctx:i};return sr(e,a,{indent:"  "})}function Sa(e){e.stack&&(e.stack=e.stack.split(`
`).filter(t=>!t.includes("tabnas/tabnas")).map(t=>t.replace(/    at /,"at ")).join(`
`))}function rs(e){let{src:t,sub:n,msg:s,cline:r,row:i,col:a,pos:o}=e;i=i!=null&&0<i?i:1,a=a!=null&&0<a?a:1;let l=r||pe.EMPTY,c=r?"\x1B[0m":pe.EMPTY;o=o!=null&&0<o?o:t==null?0:t.split(`
`).reduce((g,y,_)=>(g+=_<i-1?y.length+1:_===i-1?a:0,g),0);let f=n??pe.EMPTY,u=t.substring(Math.max(0,o-333),o).split(`
`),h=t.substring(o,o+333).split(`
`),d=2+(pe.EMPTY+(i+2)).length,p=i<3?1:i-2,b=g=>l+(pe.EMPTY+p++).padStart(d," ")+" | "+c+(g??pe.EMPTY),m=u.length;return[2<m?b(u[m-3]):null,1<m?b(u[m-2]):null,b(u[m-1]+h[0])," ".repeat(d)+"   "+" ".repeat(a-1)+l+"^".repeat(f.length||1)+" "+s+c,b(h[1]),b(h[2])].filter(g=>g!=null).join(`
`)}function tr(e){let t={active:!1,reset:"",hi:"",lo:"",line:""};e.color&&e.color.active&&Object.assign(t,e.color);let n={msg:null,hint:null,site:null,...e.txts||{}};return[e.prefix==null?null:typeof e.prefix=="function"?e.prefix(t,e):""+e.prefix,(e.code==null?"":t.hi+"["+(e.name==null?"":e.name+"/")+e.code+"]:")+t.reset+" "+(n.msg==null?"":n.msg),e.row!=null&&e.col!=null||e.file!=null?"  "+t.line+"-->"+t.reset+" "+(e.file==null?"<no-file>":e.file)+(e.row==null||e.col==null?"":":"+e.row+":"+e.col):null,e.src==null||n.site==null?"":rs({src:e.src,sub:e.sub,msg:e.smsg||e.txts?.msg,cline:t.line,row:e.row,col:e.col,pos:e.pos}),"",n.hint==null?"":n.hint,e.suffix==null?null:typeof e.suffix=="function"?e.suffix(t,e):""+e.suffix].filter(r=>r!=null).join(`
`)}function nr(e,t,n,s,r){try{let i=r.src(),a=r.cfg,o=r.meta,l=er({msg:a.error[e]||t?.use?.err&&(t.use.err.code||t.use.err.message)||a.error.unknown,hint:(a.hint[e]||t.use?.err?.message||a.hint.unknown||"").trim().split(`
`).map(h=>"  "+h).join(`
`),site:""},e,t,n,s,r);l.site=rs({src:i,msg:l.msg,cline:a.color.active?a.color.line:"",row:n.rI,col:n.cI,pos:n.sI,sub:n.src});let c=a.errmsg.suffix===!0?h=>["",...a.errmsg.link?["  "+h.lo+a.errmsg.link+h.reset]:[],"  "+h.lo+"--internal: tag="+(r.opts.tag||"")+"; rule="+s.name+"~"+s.state+"; token="+(0,kn.tokenize)(n.tin,r.cfg)+(n.why==null?"":"~"+n.why)+"; plugins="+r.plgn().map(d=>d.name).join(",")+"--"+h.reset].join(`
`):typeof a.errmsg.suffix=="string"||typeof a.errmsg.suffix=="function"?a.errmsg.suffix:void 0,f=tr({code:e,name:a.errmsg.name,txts:l,src:i,file:o?o.fileName:void 0,row:n.rI,col:n.cI,pos:n.sI,sub:n.src,color:a.color,suffix:c}),u={internal:{token:n,ctx:r}};return u={...Object.create(u),message:f,code:e,details:t,meta:o,fileName:o?o.fileName:void 0,lineNumber:n.rI,columnNumber:n.cI,txts:()=>l},u}catch(i){return console.log(i),{}}}function sr(e,t,n){let s=typeof e,r=Array.isArray(e)?"array":e==null?"string":s==="object"?s:"string",i=r==="object"?e:r==="array"?e.reduce((o,l,c)=>(o[c]=l,o),{}):{_:e},a=t??{};return Object.entries(i).map(o=>i[o[0]]=o[1]==null?"":(""+o[1]).replace(/\{([\w_0-9.]+)}/g,(l,c)=>{let f=rr(a,c);if(f=f===void 0?l:f,typeof f=="object"){let u=f?.constructor?.name;u==="Object"||u==="Array"?f=JSON.stringify(f).replace(/([^"])"/g,"$1"):f=f.toString()}else f=""+f;return n&&typeof n.indent=="string"&&(f=f.replace(/\n/g,`
`+n.indent)),f})),r==="string"?i._:r==="array"?Object.values(i):i}function rr(e,t,n){let s=e;try{let r=t.split("."),i;for(let a=0;a<r.length;a++){if(i=r[a],i==="__proto__")throw new Error(i);a<r.length-1&&(e=e[i]=e[i]||{})}if(n!==void 0){if(i==="__proto__")throw new Error(i);e[i]=n}return e[i]}catch{throw new Error("Cannot "+(n===void 0?"get":"set")+" path "+t+" on object: "+Qs(s)+(n===void 0?"":" to value: "+Qs(n,22)))}}function Qs(e,t=44){let n;try{n=typeof e=="object"?JSON.stringify(e):""+e}catch{n=""+e}return _a(t<n.length?n.substring(0,t-3)+"...":n,t)}function _a(e,t=5){return e===void 0?"":(""+e).substring(0,t).replace(/[\r\n\t]/g,".")}});var St=xe(D=>{"use strict";Object.defineProperty(D,"__esModule",{value:!0});D.MATCHER_TOKEN_NAMES=D.WIDENINGS=D.values=D.keys=D.omap=D.isarr=D.entries=D.defprop=D.assign=D.S=D.KEY_ORDER=void 0;D.recordKeyOrder=Xa;D.keyOrder=Ha;D.badlex=$a;D.charset=Dt;D.charsBitmap=yn;D.clean=xn;D.clone=Ca;D.configure=Aa;D.deep=Sn;D.escre=ct;D.filterRules=La;D.getpath=Ga;D.makelog=Ta;D.mesc=ja;D.regexp=wn;D.snip=cr;D.srcfmt=lr;D.tokenize=Rt;D.parserwrap=qa;D.str=Ma;D.findTokenSet=Ia;D.modlist=Ba;D.resolveFuncRefs=as;D.validateOptions=ls;D.validateCommentDefinitions=hr;D.rejectReservedNames=Da;D.isMatcherToken=Pa;var be=vt(),ir=qt(),or=Gt(),ut=e=>e==null?[]:Object.keys(e);D.keys=ut;var vn=e=>e==null?[]:Object.values(e);D.values=vn;var ft=e=>e==null?[]:Object.entries(e);D.entries=ft;var Ea=(e,...t)=>Object.assign(e??{},...t);D.assign=Ea;var Ut=(e,t)=>{let n=e??{};for(let s of ut(t))En(n,s,{value:t[s],writable:!0,enumerable:!0,configurable:!0});return n},Oa=e=>Array.isArray(e);D.isarr=Oa;var En=Object.defineProperty;D.defprop=En;var Et=(e,t)=>Object.entries(e||{}).reduce((n,s)=>{let r=t?t(s):s;r[0]===void 0?delete n[s[0]]:n[r[0]]=r[1];let i=2;for(;r[i]!==void 0;)n[r[i]]=r[i+1],i+=2;return n},{});D.omap=Et;var te={indent:". ",logindent:"  ",space:" ",gap:"  ",Object:"Object",Array:"Array",object:"object",string:"string",function:"function",unexpected:"unexpected",map:"map",list:"list",elem:"elem",pair:"pair",val:"val",node:"node",no_re_flags:be.EMPTY,unprintable:"unprintable",invalid_ascii:"invalid_ascii",invalid_unicode:"invalid_unicode",invalid_lex_state:"invalid_lex_state",unterminated_string:"unterminated_string",unterminated_comment:"unterminated_comment",lex:"lex",parse:"parse",error:"error",none:"none",imp_map:"imp,map",imp_list:"imp,list",imp_null:"imp,null",end:"end",open:"open",close:"close",rule:"rule",stack:"stack",nUll:"null",name:"name",make:"make",colon:":",step:"step"};D.S=te;function Aa(e,t,n){hr(n);let s=t||{};s.t=s.t||{},s.tI=s.tI||1;let r=d=>Rt(d,s);n.standard$!==!1&&(r("#BD"),r("#ZZ"),r("#UK"),r("#AA"),r("#SP"),r("#LN"),r("#CM"),r("#NR"),r("#ST"),r("#TX"),r("#VL")),s.safe={key:n.safe?.key!==!1},s.fixed={lex:!!n.fixed?.lex,token:n.fixed?Et(Fa(xn(n.fixed.token)),([d,p])=>[p,Rt(d,s)]):{},ref:void 0,check:n.fixed?.check},s.fixed.ref=Et(s.fixed.token,([d,p])=>[d,p]),s.fixed.ref=Object.assign(s.fixed.ref,Et(s.fixed.ref,([d,p])=>[p,d])),s.match={lex:!!n.match?.lex,value:n.match?Et(xn(n.match.value),([d,p])=>[d,p]):{},token:n.match?Et(xn(n.match.token),([d,p])=>[Rt(d,s),p]):{},check:n.match?.check},Et(s.match.token,([d,p])=>[d,(p.tin$=+d,p)]);let i=n.tokenSet?Object.keys(n.tokenSet).reduce((d,p)=>{let b=n.tokenSet[p];return b==null||be.SKIP===b||!Array.isArray(b)||(d[p]=b.filter(m=>m!=null).map(m=>r(m))),d},{}):{};s.tokenSet=s.tokenSet||Object.create(null),ft(i).map(d=>{let p=d[0],b=d[1];s.tokenSet[p]?(s.tokenSet[p].length=0,s.tokenSet[p].push(...b)):s.tokenSet[p]=b}),s.tokenSetTins=ft(s.tokenSet).reduce((d,p)=>(d[p[0]]=d[p[0]]||{},p[1].map(b=>d[p[0]][b]=!0),d),Object.create(null)),s.tokenSetTins.IGNORE=s.tokenSetTins.IGNORE||{},s.space={lex:!!n.space?.lex,chars:Dt(n.space?.chars),charsBitmap:yn(n.space?.chars),check:n.space?.check},s.line={lex:!!n.line?.lex,chars:Dt(n.line?.chars),charsBitmap:yn(n.line?.chars),rowChars:Dt(n.line?.rowChars),rowCharsBitmap:yn(n.line?.rowChars),single:!!n.line?.single,check:n.line?.check},s.text={lex:!!n.text?.lex,modify:(n.text?.modify?[n.text.modify]:[]).flat().filter(d=>d!=null),check:n.text?.check},s.number={lex:!!n.number?.lex,hex:!!n.number?.hex,oct:!!n.number?.oct,bin:!!n.number?.bin,sep:n.number?.sep!=null&&n.number.sep!=="",exclude:n.number?.exclude,sepChar:n.number?.sep,check:n.number?.check},s.value={lex:!!n.value?.lex,def:ft(n.value?.def||{}).reduce((d,p)=>(p[1]==null||p[1]===!1||p[1].match||(d[p[0]]=p[1]),d),Object.create(null)),defre:ft(n.value?.def||{}).filter(([,d])=>d&&d.match).map(([d,p])=>({name:d,val:p.val,match:p.match,consume:!!p.consume})).sort((d,p)=>d.name<p.name?-1:d.name>p.name?1:0)},s.rule={start:n.rule?.start==null?"val":n.rule.start,maxmul:n.rule?.maxmul==null?3:n.rule.maxmul,finish:!!n.rule?.finish,history:n.rule?.history==null||n.rule.history===!1?null:n.rule.history,include:n.rule?.include?n.rule.include.split(/\s*,+\s*/).filter(d=>d!==""):[],exclude:n.rule?.exclude?n.rule.exclude.split(/\s*,+\s*/).filter(d=>d!==""):[]},s.map={extend:!!n.map?.extend,merge:n.map?.merge,child:!!n.map?.child,ordered:!!n.map?.ordered},s.list={property:!!n.list?.property,pair:!!n.list?.pair,child:!!n.list?.child},s.info={map:!!n.info?.map,list:!!n.info?.list,text:!!n.info?.text,marker:n.info?.marker||"__info__"};let o=Object.keys(s.fixed.token).sort((d,p)=>p.length-d.length).map(d=>ct(d)).join("|"),l=n.comment?.lex?(n.comment.def?vn(n.comment.def):[]).filter(d=>d&&d.lex).map(d=>ct(d.start)).join("|"):"",c=["([",ct(ut(Dt(s.space.lex&&s.space.chars,s.line.lex&&s.line.chars)).join("")),"]",(typeof n.ender=="string"?n.ender.split(""):Array.isArray(n.ender)?n.ender:[]).map(d=>"|"+ct(d)).join(""),o===""?"":"|",o,l===""?"":"|",l,"|$)"];s.rePart={fixed:o,ender:c,commentStart:l},s.re={ender:wn(null,...c),rowChars:wn(null,ct(n.line?.rowChars)),columns:wn(null,"["+ct(n.line?.chars)+"]","(.*)$")},s.lex={empty:!!n.lex?.empty,emptyResult:n.lex?.emptyResult,relex:!!n.lex?.relex,match:n.lex?.match?ft(n.lex.match).reduce((d,p)=>{let b=p[0],m=p[1];if(m){let w=m.make(s,n);w&&(w.matcher=b,w.make=m.make,w.order=m.order),d.push(w)}return d},[]).filter(d=>d!=null&&d!==!1&&-1<+d.order).sort((d,p)=>d.order-p.order):[]};let f=n.parse?.recover;s.parse={prepare:vn(n.parse?.prepare),recover:{enabled:!!f?.enabled,syncGroups:(f?.syncGroups??["close","comma","end"]).slice(),syncTins:(f?.syncTokens??[]).map(d=>Rt(d,s)),popUntilValid:f?.popUntilValid!==!1,maxSkip:f?.maxSkip==null?64:f.maxSkip,maxRecoveries:f?.maxRecoveries==null?32:f.maxRecoveries,suppress:f?.suppress==null?4:f.suppress},budget:{checkEveryN:n.parse?.budget?.checkEveryN||0,onCheck:n.parse?.budget?.onCheck||null}},s.debug={get_console:n.debug?.get_console||(()=>console),maxlen:n.debug?.maxlen==null?99:n.debug.maxlen,print:{config:!!n.debug?.print?.config,src:n.debug?.print?.src}},s.error=n.error??{},s.errmsg=n.errmsg??{suffix:!0},s.hint=n.hint??{},n.config?.modify&&ut(n.config.modify).forEach(d=>n.config.modify[d](s,n)),Ra(s),s.debug.print.config&&s.debug.get_console().dir(s,{depth:null}),s.result={fail:[]},n.result&&(s.result.fail=[...n.result.fail]);let u=n.rewind?.history;s.rewind={history:u===!1?1/0:u==null?64:u<0?0:u};let h=n.color??{};return s.color=s.color??{},s.color.active=h.active??s.color.active??!0,s.color.reset=h.reset??s.color.reset??"\x1B[0m",s.color.hi=h.hi??s.color.hi??"\x1B[91m",s.color.lo=h.lo??s.color.lo??"\x1B[2m",s.color.line=h.line??s.color.line??"\x1B[34m",Ut(e.options,n),Ut(e.token,s.t),Ut(e.tokenSet,s.tokenSet),Ut(e.fixed,s.fixed.ref),s}function Rt(e,t,n){let s=t.t,r=s[e];return r==null&&be.STRING===typeof e&&(r=t.tI++,s[r]=e,s[e]=r,s[e.substring(1)]=r,n!=null&&Ut(n.token,t.t)),r}function Ia(e,t){let n=t.tokenSet;return n[e]??(typeof e=="string"?n[e.replace(/#/g,"")]:void 0)}function ja(e,t){return t=new String(e),t.esc=!0,t}function wn(e,...t){return new RegExp(t.map(n=>n.esc?ct(n.toString()):n).join(be.EMPTY),e??"")}function ct(e){return e==null?"":e.replace(/[-\\|\]{}()[^$+*?.!=]/g,"\\$&").replace(/\t/g,"\\t").replace(/\r/g,"\\r").replace(/\n/g,"\\n")}function Na(e){let t=e.constructor;return te.function===typeof t&&te.Object!==t.name&&te.Array!==t.name}function Sn(e,...t){let n=te.function===typeof e,s=e!=null&&(te.object===typeof e||n);for(let r of t){let i=te.function===typeof r,a=r!=null&&(te.object===typeof r||i),o;if(s&&a&&!i&&Array.isArray(e)===Array.isArray(r)&&!Na(r))for(let l in r){if(l==="__proto__"||l==="constructor"||l==="prototype"||!Object.prototype.hasOwnProperty.call(r,l))continue;let c=n?Object.prototype.hasOwnProperty.call(e,l)?e[l]:void 0:e[l],f=Sn(c,r[l]);n?En(e,l,{value:f,writable:!0,enumerable:!0,configurable:!0}):e[l]=f}else e=r===void 0||be.SKIP===r?e:i?r:a?te.function===typeof(o=r.constructor)&&te.Object!==o.name&&te.Array!==o.name?r:Sn(Array.isArray(r)?[]:{},r):r,n=te.function===typeof e,s=e!=null&&(te.object===typeof e||n)}return e}function $a(e,t,n){let s=e.next.bind(e);return e.next=(r,i,a,o)=>{let l=s(r,i,a,o);if(t===l.tin){let c={};throw l.use!=null&&(c.use=l.use),new or.TabnasError(l.why||te.unexpected,c,l,r,n)}return l},e}function Ta(e,t){let n=e.opts?.plugin?.debug?.trace;if(t||n)if(typeof t?.log=="number"||n){let s=!1,r=t?.log;(r===-1||n)&&(r=1,s=!0),e.log=(...i)=>{if(s){let a=i.filter(o=>te.object!=typeof o).map(o=>te.function==typeof o?o.name:o).join(te.gap);e.cfg.debug.get_console().log(a)}else e.cfg.debug.get_console().dir(i,{depth:r})}}else typeof t.log=="function"&&(e.log=t.log);return e.log}function Ra(e){let t=new Array(257);for(let r=0;r<=256;r++)t[r]=[];let n=r=>{for(let i=0;i<=256;i++)t[i].push(r)},s=(r,i)=>{for(let a=0;a<256;a++)i(a)&&t[a].push(r);t[256].push(r)};for(let r of e.lex.match){let i=r.matcher;if(i==="fixed"&&!e.fixed.check){let a={};for(let o of ut(e.fixed.token))if(0<o.length){let l=o.charCodeAt(0);l<256&&(a[l]=!0)}s(r,o=>a[o]===!0)}else if(i==="space"&&!e.space.check)s(r,a=>e.space.charsBitmap[a]!==0);else if(i==="line"&&!e.line.check)s(r,a=>e.line.charsBitmap[a]!==0);else if(i==="string"&&!e.string.check)s(r,a=>e.string.quoteBitmap[a]!==0);else if(i==="comment"&&!e.comment.check){let a={};for(let o of vn(e.comment.def||{})){let l=o.start;if(typeof l=="string"&&0<l.length){let c=l.charCodeAt(0);c<256&&(a[c]=!0)}}s(r,o=>a[o]===!0)}else i==="number"&&!e.number.check?s(r,a=>a===43||a===45||a===46||48<=a&&a<=57):n(r)}e.lex.dispatch=t}function lr(e){return typeof e.debug.print.src=="function"?e.debug.print.src:t=>{let n=t==null?be.EMPTY:Array.isArray(t)?JSON.stringify(t).replace(/]$/,ft(t).filter(s=>isNaN(s[0])).map((s,r)=>(r===0?", ":"")+s[0]+": "+JSON.stringify(s[1]))+"]"):JSON.stringify(t);return n=n.substring(0,e.debug.maxlen)+(e.debug.maxlen<n.length?"...":be.EMPTY),n}}function Ma(e,t=44){let n;try{n=typeof e=="object"?JSON.stringify(e):""+e}catch{n=""+e}return cr(t<n.length?n.substring(0,t-3)+"...":n,t)}function cr(e,t=5){return e===void 0?"":(""+e).substring(0,t).replace(/[\r\n\t]/g,".")}function Ca(e){let t=Object.create(Object.getPrototypeOf(e));for(let n in e)t[n]=Sn(void 0,e[n]);return t}function Dt(...e){return e==null?{}:e.filter(t=>t!==!1).map(t=>typeof t=="object"?ut(t).join(be.EMPTY):t).join(be.EMPTY).split(be.EMPTY).reduce((t,n)=>(t[n]=n.charCodeAt(0),t),{})}function yn(...e){let t=new Uint8Array(256);for(let n of e){if(n==null||n===!1)continue;let s=typeof n=="string"?n:ut(n).join(be.EMPTY);for(let r=0;r<s.length;r++){let i=s.charCodeAt(r);i<256&&(t[i]=1)}}return t}var os=new Set(["#BD","#ZZ","#UK","#AA","#SP","#LN","#CM","#NR","#ST","#TX","#VL"]);D.MATCHER_TOKEN_NAMES=os;function Pa(e){return os.has(e)}function Fa(e){if(e==null)return e;for(let t of ut(e))if(os.has(t))throw new Error(`Tabnas: ${t} is produced by a lexer matcher and cannot be bound to the fixed literal ${JSON.stringify(e[t])}. Doing so adds a second producer for the same token rather than replacing the matcher, and values silently vanish. Configure the matcher instead (options.number, options.string, options.text, options.value, options.space, options.line, options.comment), or use a token name of your own. Fixed punctuation tokens (#OB #CB #OS #CS #CL #CA) may be rebound freely.`);return e}function xn(e){for(let t in e)e[t]==null&&delete e[t];return e}function La(e,t){let n={...e.def},s=["open","close"];for(let i of s)n[i]=e.def[i].map(a=>({...a,g:typeof a.g=="string"?(a.g||"").split(/\s*,+\s*/):a.g||[]})).filter(a=>t.rule.include.reduce((o,l)=>o||a.g!=null&&a.g.indexOf(l)!==-1,t.rule.include.length===0)).filter(a=>t.rule.exclude.reduce((o,l)=>o&&(a.g==null||a.g.indexOf(l)===-1),!0));let r=Object.create(Object.getPrototypeOf(e));return Object.assign(r,e),r.def=n,r}function Ba(e,t){if(t&&e){if(0<e.length){if(t.delete&&0<t.delete.length)for(let s=0;s<t.delete.length;s++){let r=t.delete[s];if(r<0?-1*r<=e.length:r<e.length){let i=(e.length+r)%e.length;e[i]=null}}if(t.move)for(let s=0;s<t.move.length;s+=2){let r=(e.length+t.move[s])%e.length,i=(e.length+t.move[s+1])%e.length,a=e[r];e.splice(r,1),e.splice(i,0,a)}let n=e.filter(s=>s!=null);n.length!==e.length&&(e.length=0,e.push(...n))}if(t.custom){let n=t.custom(e);n!=null&&(e=n)}}return e}function qa(e){return{start:function(t,n,s,r){try{return e.start(t,n,s,r)}catch(i){if(i.name==="SyntaxError"){let a=0,o=0,l=0,c=be.EMPTY,f=i.message.match(/^Unexpected token (.) .*position\s+(\d+)/i);if(f){c=f[1],a=parseInt(f[2]),o=t.substring(0,a).replace(/[^\n]/g,be.EMPTY).length;let d=a-1;for(;-1<d&&t.charAt(d)!==`
`;)d--;l=Math.max(t.substring(d,a).length,0)}let u=i.token||(0,ir.makeToken)("#UK",Rt("#UK",n.internal().config),void 0,c,(0,ir.makePoint)(c.length,a,i.lineNumber||o,i.columnNumber||l)),h={name:"no-rule"};throw new or.TabnasError(i.code||"json",i.details||{msg:i.message},u,h,i.ctx||{uI:-1,opts:n.options,cfg:n.internal().config,token:u,meta:s,src:()=>t,root:()=>{},plgn:()=>n.internal().plugins,inst:()=>n,rule:h,sub:{},errs:[],xs:-1,v2:u,v1:u,t:[u,u],tC:-1,kI:-1,rs:[],rsI:0,rsm:Object.create(null),n:{},log:s?s.log:void 0,F:lr(n.internal().config),u:{},NORULE:h,NOTOKEN:{name:"no-token"}})}else throw i}}}}function Ga(e,t){t=typeof t=="string"?t.split("."):t;let n=e;for(let s=0;s<t.length&&n!=null;s++)n=n[t[s]];return n}var is={"options.ender":e=>te.string===typeof e,"options.lex.match.*":e=>e===!1,"options.rewind.history":e=>e===!1,"options.errmsg.suffix":e=>te.string===typeof e||te.function===typeof e};D.WIDENINGS=is;function ar(e,t){let n=is[e];if(n!=null&&n(t))return!0;let s=e.lastIndexOf(".");if(0>s)return!1;let r=is[e.substring(0,s+1)+"*"];return r!=null&&r(t)}function ls(e,t,n="options"){if(!(e==null||te.object!==typeof e||Array.isArray(e)))for(let s of Object.keys(e)){let r=e[s],i=t?.[s],a=n+"."+s;if(a==="options.rule.history"&&r!=null){if(r===!1)continue;if(typeof r!="number"||!Number.isSafeInteger(r)||r<1)throw new Error(`Tabnas: ${a} must be an integer of at least 1, null, or false`);if(be.MAX_RULE_HISTORY<r)throw new Error(`Tabnas: ${a} is outside the supported range (at most ${be.MAX_RULE_HISTORY})`);continue}if(ar(a,r))continue;let o=ur[a];if(o!=null){if(r===void 0||be.SKIP===r)continue;if(r===null){Ua.has(a)&&je(a,"object",r);continue}(te.object!==typeof r||Array.isArray(r))&&je(a,"object",r);for(let c of Object.keys(r)){let f=a+"."+c;if(fr.has(c))throw new Error(`Tabnas: ${f}: \`${c}\` is a reserved name and cannot be a ${a.slice(a.lastIndexOf(".")+1)} entry (it would reach the prototype chain)`);ar(f,r[c])||o(r[c],f)}continue}if(i==null||r===void 0||r===null||be.SKIP===r)continue;if(te.function===typeof i){te.function!==typeof r&&je(a,"function",r);continue}if(Array.isArray(i)){Array.isArray(r)||je(a,"array",r);continue}if(te.object===typeof i){if(i instanceof RegExp)continue;(te.object!==typeof r||Array.isArray(r))&&je(a,"object",r),ls(r,i,a);continue}let l=typeof i;l!==typeof r&&je(a,l,r)}}function je(e,t,n){let s=te.function===typeof n?"a function reference":n===null?"null":Array.isArray(n)?"array":typeof n;throw new Error(`Tabnas: ${e}: expected ${t}, got ${s}`+(te.function===typeof n?" (a function reference is only allowed in a declared code slot)":""))}var Ua=new Set(["options.tokenSet"]),fr=new Set(["__proto__","constructor","prototype"]),Ze=(e,t=!0)=>(n,s)=>{if(n==null&&t)return;let r=n instanceof RegExp?"regexp":Array.isArray(n)?"array":typeof n;e.includes(r)||je(s,e.join(" or "),n)},ur={"options.fixed.token":Ze(["string"]),"options.match.token":Ze(["regexp","function","string"]),"options.match.value":Ze(["regexp","function","object"]),"options.tokenSet":(e,t)=>{if(!(e===void 0||be.SKIP===e)){Array.isArray(e)||je(t,"array",e);for(let n=0;n<e.length;n++)e[n]!=null&&be.SKIP!==e[n]&&te.string!==typeof e[n]&&je(t+"["+n+"]","string",e[n])}},"options.comment.def":(e,t)=>{e==null||e===!1||be.SKIP===e||((te.object!==typeof e||Array.isArray(e))&&je(t,"object",e),ls(e,Ka,t))},"options.value.def":(e,t)=>{e==null||e===!1||be.SKIP===e||((te.object!==typeof e||Array.isArray(e))&&je(t,"object",e),e.consume!==void 0&&e.consume!==null&&typeof e.consume!="boolean"&&je(t+".consume","boolean",e.consume))},"options.string.escape":Ze(["string"]),"options.string.replace":Ze(["string"]),"options.error":Ze(["string"]),"options.hint":Ze(["string"]),"options.parse.prepare":Ze(["function"]),"options.config.modify":Ze(["function"]),"options.lex.match":(e,t)=>{e!=null&&((te.object!==typeof e||Array.isArray(e))&&je(t,"object",e),e.order!=null&&typeof e.order!="number"&&je(t+".order","number",e.order),e.make!=null&&te.function!==typeof e.make&&je(t+".make","function",e.make))},"options.plugin":()=>{}};function Da(e){if(!(e==null||te.object!==typeof e))for(let t of Object.keys(ur)){let n=e,s=t.split(".").slice(1);for(let r of s)n=n!=null&&te.object===typeof n&&Object.prototype.hasOwnProperty.call(n,r)?n[r]:void 0;if(!(n==null||te.object!==typeof n||Array.isArray(n))){for(let r of Object.keys(n))if(fr.has(r))throw new Error(`Tabnas: ${t}.${r}: \`${r}\` is a reserved name and cannot be a ${t.slice(t.lastIndexOf(".")+1)} entry (it would reach the prototype chain)`)}}}var Ka={line:!0,start:"#",end:"*/",lex:!0,eatline:!1};function hr(e){let t=e.comment?.def;if(t!=null){for(let[n,s]of ft(t))if(!(s==null||s===!1||s.line)&&(typeof s.end!="string"||s.end.length===0))throw new Error(`Tabnas: options.comment.def.${n}.end: block comments require a non-empty end marker`)}}function as(e,t){if(e==null||typeof e!="object"){if(typeof e=="string"&&e[0]==="@"){if(e[1]==="@")return e.substring(1);if(e.substring(1)==="SKIP")return be.SKIP;let r=e.match(/^@\/(.*)\/([\w]*)$/);if(r)return new RegExp(r[1],r[2]);let i=e.match(/^@~\/(.*)\/([\w]*)$/);if(i){let a=new RegExp(i[1],i[2]);return a.eager$=!0,a}if(t){let a=t[e];if(typeof a=="function")return a}}return e}if(Array.isArray(e))return e.map(r=>as(r,t));let n=e.constructor;if(n&&n.name!=="Object")return e;let s={};for(let r of Object.keys(e))s[r]=as(e[r],t);return s}var _n=Symbol.for("tabnas.keyOrder");D.KEY_ORDER=_n;function Xa(e,t){let n=e[_n];n===void 0&&(n=[],En(e,_n,{value:n,enumerable:!1,writable:!0,configurable:!0})),n.push(""+t)}function Ha(e){if(e!=null&&typeof e=="object"){let t=e[_n];return t!==void 0?t.slice():Object.keys(e)}return[]}});var fs=xe(ht=>{"use strict";Object.defineProperty(ht,"__esModule",{value:!0});ht.BUILTIN_REFS=ht.BUILTIN_CONFIG_FACTORY=ht.BUILTIN_SCHEMA_VERSION=void 0;var Ya=St();ht.BUILTIN_SCHEMA_VERSION=5;var za=Object.defineProperty;function dr(e,t){let n=t.length;for(let s=0;s<n;s++)e.push(t[s])}function cs(e,t,n){e!=null&&typeof e=="object"&&za(e,t,{value:n,writable:!0})}function pr(e,t){return t==="user"?{rule:e,src:"",kids:[]}:{src:"",kids:[]}}var mr=e=>t=>{e.init&&(t.node=pr(e.rule,e.kind));let n=t.node,s=e.nterms||0;for(let r=0;r<s;r++)n.src+=t.o[r].src},gr=e=>t=>{t.node==null&&(t.node=pr(e.rule,e.kind));let n=t.node,s=t.child&&t.child.node;if(s!=null){if(typeof s!="object"||!("src"in s)){n.kids.push(s);return}s!==n&&(n.src+=s.src,s.rule?n.kids.push(s):Array.isArray(s.kids)&&dr(n.kids,s.kids))}},Va=e=>{e.child&&e.child.node!==void 0&&(e.node=e.child.node)},br=e=>t=>{let n=t.parent&&t.parent.node;if(n==null||typeof n!="object"||!("src"in n))return;let s=t.node;s!=null&&typeof s=="object"&&"src"in s&&s!==n&&(n.src+=s.src,s.rule?n.kids.push(s):Array.isArray(s.kids)&&dr(n.kids,s.kids));let r=e.cN||0;for(let i=0;i<r;i++)n.src+=t.c[i].src;t.node=void 0},Wa=(e,t)=>{e.k.pd_phase=0,e.k.pd_mark=t.mark()},Za=(e,t)=>{if(e.k.pd_mark==null)throw new Error("@probeDecide$: no pd_mark \u2014 phase-0 @probeInit$ did not run");let n=t.t[0];t.rewind(e.k.pd_mark),e.k.pd_phase=n&&n.name===e.k.pd_d?1:2},Ja=e=>!e.k.pd_phase,Qa=e=>e.k.pd_phase===1,eo=e=>e.k.pd_phase===2,kr=e=>(t,n)=>{let s=Object.create(null);t.node=s,n.cfg.info.map&&cs(s,n.cfg.info.marker,{implicit:!!e.implicit,meta:{}})},wr=e=>(t,n)=>{let s=[];t.node=s,n.cfg.info.list&&cs(s,n.cfg.info.marker,{implicit:!!e.implicit,meta:{}})},to=e=>{e.node=void 0},yr=e=>t=>{t.u[e.slot||"key"]=typeof e.lit=="string"?e.lit:t.o[e.from||0]?.val},xr=e=>e===!0,vr=e=>e!=null&&typeof e=="object"&&typeof e.src=="string"?e.src:e,Sr=e=>(t,n)=>{let s=t.node;if(s!=null&&typeof s=="object"){let r=t.u[e.slot||"key"];if(n.cfg.info.map&&r===n.cfg.info.marker)return;n.cfg.map&&n.cfg.map.ordered&&!(r in s)&&(0,Ya.recordKeyOrder)(s,r),s[r]=xr(e.src)?vr(t.child.node):t.child.node}},_r=e=>t=>{t.child.node!==void 0&&Array.isArray(t.node)&&t.node.push(xr(e.src)?vr(t.child.node):t.child.node)},Er=e=>(t,n)=>{if(t.child.node!==void 0){t.node=t.child.node;return}let s=t.o[e.from||0],r=s?s.resolveVal(t,n):void 0,i=n.cfg.info;if(i.text&&typeof r=="string"&&s&&(s.tin===n.cfg.t.ST||s.tin===n.cfg.t.TX)){let a=s.tin===n.cfg.t.ST&&s.src.length>0?s.src[0]:"",o=new String(r);cs(o,i.marker,{quote:a}),r=o}t.node=r},no=mr({}),so=gr({}),ro=br({}),io=kr({}),ao=wr({}),oo=yr({}),lo=_r({}),co=Sr({}),fo=Er({});ht.BUILTIN_CONFIG_FACTORY=Object.freeze({"@node$":mr,"@capture$":gr,"@fold$":br,"@object$":kr,"@array$":wr,"@key$":yr,"@setval$":Sr,"@push$":_r,"@value$":Er});ht.BUILTIN_REFS=Object.freeze({"@node$":no,"@capture$":so,"@bubble$":Va,"@fold$":ro,"@probeInit$":Wa,"@probeDecide$":Za,"@probePhase0$":Ja,"@probePhase1$":Qa,"@probePhase2$":eo,"@object$":io,"@array$":ao,"@reset$":to,"@key$":oo,"@setval$":co,"@push$":lo,"@value$":fo})});var us=xe(On=>{"use strict";Object.defineProperty(On,"__esModule",{value:!0});On.defaults=void 0;var dt=qt(),uo={safe:{key:!0},tag:"-",fixed:{lex:!0,token:{"#OB":"{","#CB":"}","#OS":"[","#CS":"]","#CL":":","#CA":","}},match:{lex:!0,token:{}},tokenSet:Object.assign(Object.create(null),{IGNORE:["#SP","#LN","#CM"],VAL:["#TX","#NR","#ST","#VL"],KEY:["#TX","#NR","#ST","#VL"]}),space:{lex:!0,chars:" 	"},line:{lex:!0,chars:`\r
`,rowChars:`
`,single:!1},text:{lex:!0},number:{lex:!0,hex:!0,oct:!0,bin:!0,sep:"_",exclude:void 0},comment:{lex:!0,def:{hash:{line:!0,start:"#",lex:!0,eatline:!1},slash:{line:!0,start:"//",lex:!0,eatline:!1},multi:{line:!1,start:"/*",end:"*/",lex:!0,eatline:!1}}},string:{lex:!0,chars:"'\"`",multiChars:"`",escapeChar:"\\",escape:{b:"\b",f:"\f",n:`
`,r:"\r",t:"	",v:"\v",'"':'"',"'":"'","`":"`","\\":"\\","/":"/"},allowUnknown:!0,escapeStrict:!1,allowControl:!1,abandon:!1},map:{extend:!0,merge:void 0,child:!1},list:{property:!0,pair:!1,child:!1},info:{map:!1,list:!1,text:!1,marker:"__info__"},value:{lex:!0,def:{true:{val:!0},false:{val:!1},null:{val:null}}},ender:[],plugin:{},debug:{get_console:()=>console,maxlen:99,print:{config:!1,src:void 0}},error:{unknown:"unknown error: {code}",unexpected:"unexpected character(s): {src}",invalid_unicode:"invalid unicode escape: {src}",invalid_ascii:"invalid ascii escape: {src}",unprintable:"unprintable character: {src}",unterminated_string:"unterminated string: {src}",unterminated_comment:"unterminated comment: {src}",unknown_rule:"unknown rule: {rulename}",end_of_source:"unexpected end of source",cancel:"parse cancelled"},errmsg:{name:"tabnas",suffix:!0},hint:{unknown:`
Unknown error code: {code}
Details:
{details}`,unexpected:`
The character(s) {src} do not match any rule alternative active at
this position.`,invalid_unicode:`
The escape sequence {src} does not encode a valid unicode code point.`,invalid_ascii:`
The escape sequence {src} does not encode a valid ASCII character.`,unprintable:`
The character {src} (code point below 32) is not allowed inside a
string literal.`,unterminated_string:`
This string has no end quote.`,unterminated_comment:`
This comment is never closed.`,unknown_rule:`
No rule named {rulename} is defined.`,end_of_source:`
Unexpected end of source.`,cancel:`
The parse was cancelled by the caller's parse.budget.onCheck callback
(or exceeded its configured budget) before completing.`},lex:{match:{match:{order:1e6,make:dt.makeMatchMatcher},fixed:{order:2e6,make:dt.makeFixedMatcher},space:{order:3e6,make:dt.makeSpaceMatcher},line:{order:4e6,make:dt.makeLineMatcher},string:{order:5e6,make:dt.makeStringMatcher},comment:{order:6e6,make:dt.makeCommentMatcher},number:{order:7e6,make:dt.makeNumberMatcher},text:{order:8e6,make:dt.makeTextMatcher}},empty:!0,emptyResult:void 0,relex:!1},parse:{prepare:{},recover:{enabled:!1,syncGroups:null,syncTokens:[],popUntilValid:!0,maxSkip:64,maxRecoveries:32,suppress:4},budget:{checkEveryN:0,onCheck:null}},rule:{start:"val",finish:!0,maxmul:3,history:null,include:"",exclude:""},result:{fail:[]},rewind:{history:64},config:{modify:{}},parser:{start:void 0}};On.defaults=uo});var Or=xe(An=>{"use strict";Object.defineProperty(An,"__esModule",{value:!0});An.Context=void 0;var hs=class{constructor(t){this.uI=0,this.xs=-1,this.errs=[],this.v=[],this.vAbs=0,this.tC=-2,this.kI=-1,this.rs=[],this.rsI=0,this.u={},this.opts=t.opts,this.cfg=t.cfg,this.meta=t.meta,this.src=t.src,this.root=t.root,this.plgn=t.plgn,this.inst=t.inst,this.sub=t.sub,this.rsm=t.rsm,this.F=t.F,this.NOTOKEN=t.NOTOKEN,this.NORULE=t.NORULE,this.rule=t.NORULE,this.t=[t.NOTOKEN,t.NOTOKEN]}get t0(){return this.t[0]??this.NOTOKEN}set t0(t){this.t[0]=t}get t1(){return this.t[1]??this.NOTOKEN}set t1(t){this.t[1]=t}get v1(){return this.v[this.v.length-1]??this.NOTOKEN}set v1(t){0<this.v.length?this.v[this.v.length-1]=t:this.v.push(t)}get v2(){return this.v[this.v.length-2]??this.NOTOKEN}set v2(t){let n=this.v.length;1<n?this.v[n-2]=t:n===1?this.v.unshift(t):this.v.push(t)}mark(){return this.vAbs}rewind(t){let n=this.vAbs-t;if(n<=0)return;if(n>this.v.length)throw new Error(`tabnas: ctx.rewind target ${t} is outside the retained history window (oldest mark available is ${this.vAbs-this.v.length}, current is ${this.vAbs}); increase options.rewind.history.`);let s=this.lex.pnt.token,r=this.NOTOKEN,i=[];for(let a=0;a<this.t.length;a++){let o=this.t[a];o&&o!==r&&i.push(o),this.t[a]=r}for(let a=i.length-1;a>=0;a--)s.unshift(i[a]);for(let a=0;a<n;a++)s.unshift(this.v.pop());this.vAbs-=n,this.lex.pnt.end=void 0}};An.Context=hs});var ks=xe(we=>{"use strict";Object.defineProperty(we,"__esModule",{value:!0});we.makeRuleSpec=we.makeNoRule=we.makeRule=we.AltMatch=we.RuleSpec=we.Rule=void 0;we.publishedHistoryChildSnapshot=ps;we.refreshHistoryChild=ms;we.validateAlt=Gr;we.validateAlts=vo;we.validateGrammar=Eo;we.continuationTins=go;var ce=vt(),_e=St(),Ar=fs(),Xt=Gt(),In=class e{#e;#t;#s;#n;get n(){return this.#t??=Object.create(null)}set n(t){this.#t=t}get u(){return this.#s??=Object.create(null)}set u(t){this.#s=t}get k(){return this.#n??=Object.create(null)}set k(t){this.#n=t}rawn(){return this.#t}rawu(){return this.#s}rawk(){return this.#n}constructor(t,n,s,r){this.i=-1,this.name=ce.EMPTY,this.#e={value:null},this.state=ce.OPEN,this.d=-1,this.bo=!1,this.ao=!1,this.bc=!1,this.ac=!1,this.oN=0,this.cN=0,this.need=0,this.i=r===void 0?n.uI++:r,this.name=t.name,this.spec=t,(0,_e.defprop)(this,"node",{configurable:!0,enumerable:!0,get:()=>this.#e.value,set:i=>{this.#e.value=i}}),this.child=n.NORULE,this.parent=n.NORULE,this.prev=n.NORULE,this.next=n.NORULE,this._NOTOKEN=n.NOTOKEN,this.o=[],this.c=[],this.node=s,this.d=n.rsI,this.bo=t.def.bo!=null,this.ao=t.def.ao!=null,this.bc=t.def.bc!=null,this.ac=t.def.ac!=null}snapshot(t){let n=new e(this.spec,t,this.node,this.i);return n.#e=this.#e,n.name=this.name,n.state=this.state,n.d=this.d,n.bo=this.bo,n.ao=this.ao,n.bc=this.bc,n.ac=this.ac,n.oN=this.oN,n.cN=this.cN,n.child=this.child,n.parent=this.parent,n.prev=this.prev,n.next=this.next,n.o=this.o.slice(),n.c=this.c.slice(),n._NOTOKEN=this._NOTOKEN,n.need=this.need,n.why=this.why,this.#t!==void 0&&(n.#t=Object.assign(Object.create(null),this.#t)),this.#s!==void 0&&(n.#s=Object.assign(Object.create(null),this.#s)),this.#n!==void 0&&(n.#n=Object.assign(Object.create(null),this.#n)),n}get o0(){return this.o[0]??this._NOTOKEN}set o0(t){this.o[0]=t}get o1(){return this.o[1]??this._NOTOKEN}set o1(t){this.o[1]=t}get c0(){return this.c[0]??this._NOTOKEN}set c0(t){this.c[0]=t}get c1(){return this.c[1]??this._NOTOKEN}set c1(t){this.c[1]=t}get os(){return this.oN}set os(t){this.oN=t}get cs(){return this.cN}set cs(t){this.cN=t}process(t,n){return this.spec.process(this,t,n,this.state)}eq(t,n=0){return(this.#t?.[t]??0)===n}lt(t,n=0){return(this.#t?.[t]??0)<n}gt(t,n=0){return(this.#t?.[t]??0)>n}lte(t,n=0){return(this.#t?.[t]??0)<=n}gte(t,n=0){return(this.#t?.[t]??0)>=n}exist(t){return this.#t?.[t]!=null}toString(){return"[Rule "+this.name+"~"+this.i+"]"}};we.Rule=In;var jn=(...e)=>new In(...e);we.makeRule=jn;var ho=(e,t)=>jn(Lr(e,t.cfg,{}),t);we.makeNoRule=ho;function Ht(e,t,n,s){if(n==null)return e;let r=[],i=e;for(;i!==t.NORULE&&r.length<n;)r.push(i),i=i.prev;let a=t.NORULE;for(let o=r.length-1;0<=o;o--){let l=r[o].snapshot(t);(o!==0||s!=="parent")&&(l.child=t.NORULE,l.next=t.NORULE),l.prev=a,a=l}return a}function Yt(e,t){let n=e.historyPusher;if(n==null||n.child.i!==e.i)return;let s=Ht(e,t,t.cfg.rule.history,"prev");n.child=s,n.next.i===e.i&&(n.next=s)}function ps(e,t){let n=e.historyPusher;if(!(n==null||n.child.i!==e.i))return n.child.snapshot(t)}function ds(e,t,n){let s=t??{},r=n??{},i=new Set([...Object.keys(s),...Object.keys(r)]),a;for(let o of i){let l=Object.prototype.hasOwnProperty.call(s,o),c=Object.prototype.hasOwnProperty.call(r,o),f=s[o],u=r[o];l===c&&(!l||Object.is(f,u))||(a??=e(),c?a[o]=u:delete a[o])}}function Ir(e,t){return e.length===t.length&&e.every((n,s)=>n===t[s])}function ms(e,t,n){let s=e.historyPusher;if(s==null||s.child.i!==e.i)return;let r=s.child,i=Ht(e,t,t.cfg.rule.history,"prev");n!=null&&(ds(()=>i.n,n.rawn(),r.rawn()),ds(()=>i.u,n.rawu(),r.rawu()),ds(()=>i.k,n.rawk(),r.rawk()),Ir(n.o,r.o)||(i.o=r.o.slice(),i.oN=r.oN),Ir(n.c,r.c)||(i.c=r.c.slice(),i.cN=r.cN),n.need!==r.need&&(i.need=r.need),n.why!==r.why&&(i.why=r.why)),s.child=i,s.next.i===e.i&&(s.next=i)}var Nn=class{constructor(){this.p=ce.EMPTY,this.r=ce.EMPTY,this.b=0}};we.AltMatch=Nn;var Fr=(...e)=>new Nn(...e),po=Fr(),$n=class{constructor(t,n,s){this.name=ce.EMPTY,this.def={open:[],close:[],bo:[],bc:[],ao:[],ac:[],tcol:[],first:[],fnref:{}},this.ji=t,this.cfg=n,this.def=Object.assign(this.def,s),this.def.open=(this.def.open||[]).filter(i=>i!=null),this.def.close=(this.def.close||[]).filter(i=>i!=null);for(let i of this.def.open)Kt(i,ce.OPEN,this);for(let i of this.def.close)Kt(i,ce.CLOSE,this);let r=["bo","ao","bc","ac"];for(let i of r)for(let a of this.def[i]??[])if(typeof a=="object"){let o=a;this[i](o.append,o.action)}}tin(t){return(0,_e.tokenize)(t,this.cfg)}fnref(t){Object.assign(this.def.fnref,t);let n=this.name,s=this.def.fnref,r=this.def.fnrefInstalled=this.def.fnrefInstalled||new Map,i=this.def.fnrefReplaced=this.def.fnrefReplaced||new Set,a=[`@${n}-bo`,`@${n}-ao`,`@${n}-bc`,`@${n}-ac`];for(let o of a){let l=r.get(o);l||r.set(o,l=new WeakSet);let c=o.substring(o.length-2),f=s[o+"/replace"];if(f){i.has(o)||(i.add(o),this.def[c].length=0,l=new WeakSet,r.set(o,l),l.add(f),this[c](!0,f));continue}if(i.has(o))continue;let u=s[o+"/prepend"],h=s[o+"/append"]??s[o];u&&!l.has(u)&&(l.add(u),this[c](!1,u)),h&&!l.has(h)&&(l.add(h),this[c](!0,h))}return this}add(t,n,s){let r=s?.append?"push":"unshift",i=((0,_e.isarr)(n)?n:[n]).filter(l=>l!=null&&typeof l=="object").map(l=>Kt(l,t,this)),a=t==="o"?"open":"close",o=this.def[a];if(s?.clear&&(o.length=0),r==="push")for(let l=0;l<i.length;l++)o.push(i[l]);else{let l=o.splice(0,o.length);for(let c=0;c<i.length;c++)o.push(i[c]);for(let c=0;c<l.length;c++)o.push(l[c])}return o=this.def[a]=(0,_e.modlist)(o,s),this.norm(),this}open(t,n){return this.add("o",t,n)}close(t,n){return this.add("c",t,n)}action(t,n,s,r){let i=this.def[n+s];return t?i.push(r):i.unshift(r),this}bo(t,n){return this.action(n?!!t:!0,ce.BEFORE,ce.OPEN,typeof t=="string"?this.def.fnref[t]:n??t)}ao(t,n){return this.action(n?!!t:!0,ce.AFTER,ce.OPEN,typeof t=="string"?this.def.fnref[t]:n??t)}bc(t,n){return this.action(n?!!t:!0,ce.BEFORE,ce.CLOSE,typeof t=="string"?this.def.fnref[t]:n??t)}ac(t,n){return this.action(n?!!t:!0,ce.AFTER,ce.CLOSE,typeof t=="string"?this.def.fnref[t]:n??t)}clear(){return this.def.open.length=0,this.def.close.length=0,this.def.bo.length=0,this.def.ao.length=0,this.def.bc.length=0,this.def.ac.length=0,this}clearOpen(){return this.def.open.length=0,this}clearClose(){return this.def.close.length=0,this}clearActions(...t){let n=0<t.length?t:["bo","ao","bc","ac"],s=this.def.fnrefInstalled,r=this.def.fnrefReplaced;for(let i of n){this.def[i].length=0;let a=`@${this.name}-${i}`;s&&s.delete(a),r&&r.delete(a)}return this}norm(){this.def.open.map(a=>Kt(a,ce.OPEN,this)),this.def.close.map(a=>Kt(a,ce.CLOSE,this));let t=[],n=a=>a.reduce((o,l)=>Math.max(o,l.sN||0),0),s=n(this.def.open),r=n(this.def.close);for(let a=0;a<s;a++)this.def.open.reduce(...i(0,a,t));for(let a=0;a<r;a++)this.def.close.reduce(...i(1,a,t));t[0]=t[0]||[],t[1]=t[1]||[];for(let a=0;a<s;a++)t[0][a]=t[0][a]||[];for(let a=0;a<r;a++)t[1][a]=t[1][a]||[];this.def.tcol=t,this.def.first=[Rr(this.def.open),Rr(this.def.close)];function i(a,o,l){l[a]=l[a]||[];let c=l[a][o]=l[a][o]||[];return[function(f,u){let h=u.t&&u.t[o];if(h&&0<h.length){let d=[...new Set(f.concat(h))];f.length=0,f.push(...d)}return f},c]}return this}process(t,n,s,r){n.log&&n.log(_e.S.rule,n,t,s);let i=r==="o",a=i?t:n.NORULE,o=i?"O":"C",l=this.def,c=n.log!=null,f=i?l.open:l.close,u=i?t.bo?l.bo:null:t.bc?l.bc:null;if(t._skipBefores&&(t._skipBefores=!1,u=null),u){let g;for(let y=0;y<u.length;y++)if(g=u[y].call(this,t,n,a,g),g?.isToken&&g?.err)return this.bad(g,t,n,{is_open:i})}let h=0<f.length?ko(i,f,s,t,n):po;if(h.h&&(h=h.h(t,n,h,a)||h,c&&(o+="H")),n._dalt=0<f.length?h:null,h.e==null&&h.ef){let g=h.ef(t,n,h);g&&(h.e=g)}if(h.e)return this.bad(h.e,t,n,{is_open:i});if(h.n){let g=t.n;for(let y in h.n)g[y]=h.n[y]===0?0:(g[y]==null?0:g[y])+h.n[y]}h.u&&(t.u=Object.assign(t.u,h.u)),h.k&&(t.k=Object.assign(t.k,h.k));let d=t[i?"oN":"cN"]-(h.b||0);if(d<0&&(d=0),0<d){let g=n.NOTOKEN;for(let _=0;_<d;_++)n.v.push(n.t[_]),n.t[_]=g;n.vAbs+=d;let y=n.cfg.rewind.history;y!==1/0&&n.v.length>2*y&&n.v.splice(0,n.v.length-y)}if(h.a){c&&(o+="A");let g=h.a(t,n,h);if(g&&g.isToken&&g.err)return this.bad(g,t,n,{is_open:i})}let p=!1,b=!1,m=!1;if(h.p){n.rs[n.rsI++]=t;let g=n.rsm[h.p];if(g){a=jn(g,n,t.node);let y=t.rawn();if(y!==void 0){let v;for(let x in y)(v??=a.n)[x]=y[x]}let _=t.rawk();if(_!==void 0){let v;for(let x in _)(v??=a.k)[x]=_[x]}p=n.cfg.rule.history!=null,p?(a.parent=Ht(t,n,n.cfg.rule.history,"pusherBefore"),t.child=a.snapshot(n),a.historyPusher=t):(a.parent=t,t.child=a),c&&(o+="P`"+h.p+"`")}else return this.bad(this.unknownRule(n.t0,h.p),t,n,{is_open:i})}else if(h.r){let g=n.rsm[h.r];if(g){a=jn(g,n,t.node),a.parent=t.parent,b=n.cfg.rule.history!=null,b?a.historyPusher=t.historyPusher:a.prev=t;let y=t.rawn();if(y!==void 0){let v;for(let x in y)(v??=a.n)[x]=y[x]}let _=t.rawk();if(_!==void 0){let v;for(let x in _)(v??=a.k)[x]=_[x]}c&&(o+="R`"+h.r+"`")}else return this.bad(this.unknownRule(n.t0,h.r),t,n,{is_open:i})}else i||(m=!0,a=n.rs[--n.rsI]||n.NORULE);t.next=p?t.child:a;let w=i?t.ao?l.ao:null:t.ac?l.ac:null;if(w){let g;for(let y=0;y<w.length;y++)if(g=w[y](t,n,a,g),g?.isToken&&g?.err)return this.bad(g,t,n,{is_open:i})}if(a.why=o,n.log&&n.log(_e.S.node,n,t,s,a),ce.OPEN===t.state&&(t.state=ce.CLOSE),p?a.parent=Ht(t,n,n.cfg.rule.history,"parent"):b?(a.prev=Ht(t,n,n.cfg.rule.history,"prev"),Yt(t,n),t.next=n.NORULE):m&&n.cfg.rule.history!=null&&Yt(t,n),0<d){let g=n.t.length;for(let y=0;y<g-d;y++)n.t[y]=n.t[y+d];for(let y=Math.max(0,g-d);y<g;y++)n.t[y]=n.NOTOKEN}return a}bad(t,n,s,r){if(s.cfg?.parse?.recover?.enabled){let a=bo(t,n,s,r);if(a!=null)return a;let o=s.errs?.[s.errs.length-1];if(o!=null)throw o}throw new Xt.TabnasError(t.err||_e.S.unexpected,{...t.use,state:r.is_open?_e.S.open:_e.S.close},t,n,s)}unknownRule(t,n){return t.err="unknown_rule",t.use=t.use||{},t.use.rulename=n,t}};we.RuleSpec=$n;var Lr=(...e)=>new $n(...e);we.makeRuleSpec=Lr;var jr=new WeakMap,Br={unprintable:!0,invalid_unicode:!0,invalid_ascii:!0};function qr(e,t,n){let s=e.pnt,r=e.src,a=e.ctx?.cfg?.line?.rowChars,o=c=>a!=null?!!a[c]:c===`
`,l=Math.max(s.sI,t.sI+Math.max(1,t.len|0));if(n){let c=l;for(;c<r.length&&!o(r[c]);)c++;l=Math.max(l,Math.min(r.length,c+1))}for(;s.sI<l&&s.sI<r.length;)o(r[s.sI])?(s.rI++,s.cI=1):s.cI++,s.sI++}function Tn(e,t,n){let s=e.def?.close??[],r=jr.get(s);if(r==null||r.len!==s.length||r.sig!==n){let i=new Set,a=new Set,o=!1;for(let l of s){if((l.sN|0)===0){o=!0;continue}let c=l.t?.[0]??[];for(let u of c)a.add(u);let f=l.g??[];for(let u of f)if(t.includes(u)){for(let h of c)i.add(h);break}}r={len:s.length,sig:n,sync:i,all:a,any:o},jr.set(s,r)}return r}function mo(e,t){let n=e.cfg.parse.recover,s=n.syncGroups.join(","),r=new Set,i=a=>{a!=null&&a!==e.NORULE&&Tn(a.spec,n.syncGroups,s).sync.forEach(o=>r.add(o))};i(t);for(let a=e.rsI-1;0<=a;a--)i(e.rs[a]);if(r.size===0){let a=o=>{o!=null&&o!==e.NORULE&&Tn(o.spec,n.syncGroups,s).all.forEach(l=>r.add(l))};a(t);for(let o=e.rsI-1;0<=o;o--)a(e.rs[o])}for(let a of n.syncTins)r.add(a);return r}function Nr(e,t,n,s){let r=Tn(e,n,s);return r.any||r.all.has(t)}function $r(e,t){let n=e.sN|0,s=t.t,r=t.NOTOKEN,i=1<<t.cfg.t.AA-1,a=0;for(;a<n;){let o=s[a];if(o==null||r===o)break;let l=e.S?e.S[a]:null;if(l!=null){let c=o.tin,f=c/31|0,u=f===0?i:0;if((l[f]&(1<<c%31-1|u))===0)break}a++}return a}function go(e,t,n){let s=new Set;if(t==null||e==null||t===e.NORULE)return[];let r=n??0,i=e._contTins;if(i!=null&&0<i.length)for(let u of i)s.add(u);else{let u=ce.OPEN===t.state?t.spec.def?.open:t.spec.def?.close;for(let h of u??[]){let d=h.sN|0,p=$r(h,e);if(p===r&&p<d)for(let b of h.t?.[p]??[])s.add(b)}}let a=t,o=e.rsI-1;for(;Tn(a.spec,[],"").any;){let h=0<=o?e.rs[o--]:void 0;if(h==null||h===e.NORULE)break;let p=h.spec.def?.tcol?.[1]?.[0]??[];for(let b of p)s.add(b);a=h}let l=new Set,c=u=>{if(u==null||u===!1||u===0)return;let h=String(u);if(h===""||l.has(h))return;l.add(h);let d=e.rsm[h];if(d==null)return;let p=d.def?.tcol?.[0]?.[0]??[];for(let b of p)s.add(b);for(let b of d.def?.open??[])(b.sN|0)===0&&(c(b.p),c(b.r))},f=ce.OPEN===t.state?t.spec.def?.open:t.spec.def?.close;for(let u of f??[]){let h=u.sN|0;if($r(u,e)!==h)continue;let d=u.b;d!=null&&d!==!1&&typeof d!="number"||h-(typeof d=="number"?d:0)!==r||(c(u.p),c(u.r))}return[...s].sort((u,h)=>u-h)}function bo(e,t,n,s){let r=n.cfg.parse.recover,i=n.lex;if(i==null)return;let a=new Xt.TabnasError(e.err||e.why||_e.S.unexpected,{...e.use,state:s.is_open?_e.S.open:_e.S.close},e,t,n),o=n._recoverAt;if(o!=null&&n.vAbs-o<r.suppress&&n.errs[n.errs.length-1]===a&&n.errs.pop(),r.maxRecoveries<n.errs.length)return;let l=n._recoverSI??-1,c=o!=null&&o===n.vAbs;n._recoverAt=n.vAbs;let f=mo(n,t),u=n.cfg.t.ZZ,h=n.cfg.t.BD,d=n.cfg.tokenSetTins.IGNORE,p=n.NOTOKEN,b=n.t,m=(x,S)=>qr(i,x,S),w=[];for(let x=0;x<b.length;x++){let S=b[x];S!=null&&p!==S&&w.push(S),b[x]=p}let g=()=>{let x;do x=i.next(t);while(d[x.tin]);return x},y=0<w.length?w.shift():g(),_=0;for(;u!==y.tin&&(!f.has(y.tin)||c&&y.sI<=l);){if(h===y.tin&&m(y,Br[y.why]===!0),r.maxSkip<=_++)return;y=0<w.length?w.shift():g()}if(u===y.tin&&c&&l>=y.sI)return;n._recoverSI=y.sI,b[0]=y;for(let x=0;x<w.length&&x+1<b.length;x++)b[x+1]=w[x];a.recovered={skipped:_,sync:y.tin};let v=r.syncGroups.join(",");if(r.popUntilValid){if(t!==n.NORULE&&Nr(t.spec,y.tin,r.syncGroups,v))return ce.OPEN===t.state?t.state=ce.CLOSE:s.is_open||(t._skipBefores=!0),t;if(t!==n.NORULE&&Yt(t,n),t!==n.NORULE&&n.sub.ruleDone){let x=ps(t,n),S={state:ce.CLOSE,alt:null,forced:!0};n.sub.ruleDone.map(O=>O(t,n,S)),ms(t,n,x)}for(;0<n.rsI;){let x=n.rs[--n.rsI];if(x!=null&&Nr(x.spec,y.tin,r.syncGroups,v))return x;if(x!=null&&Yt(x,n),x!=null&&n.sub.ruleDone){let S=ps(x,n),O={state:ce.CLOSE,alt:null,forced:!0};n.sub.ruleDone.map($=>$(x,n,O)),ms(x,n,S)}}return}if(t!==n.NORULE&&Yt(t,n),0<n.rsI)return n.rs[--n.rsI]}var Tr=[];function Rr(e){let t=new Map,n=[];for(let s=0;s<e.length;s++){let r=e[s];if((r.sN|0)===0||r.S==null||r.S[0]==null){n.push(s);continue}for(let i of r.t[0]??[]){let a=t.get(i);a==null&&(a=[],t.set(i,a)),a[a.length-1]!==s&&a.push(s)}}return{alts:e,n:e.length,byTin:t,wild:n}}function ko(e,t,n,s,r){let i=r._palt||(r._palt=Fr());r._contTins=void 0,i.b=0,i.p=ce.EMPTY,i.r=ce.EMPTY,i.n=void 0,i.h=void 0,i.a=void 0,i.u=void 0,i.k=void 0,i.e=void 0;let a=null,o=0,l=r.cfg.t,c=!0,f=1<<l.AA-1,u=r.cfg.tokenSetTins.IGNORE,h=l.BD,d=_e.S.unexpected,p=t.length,b=r.NOTOKEN,m=r.t,w=r.cfg.lex.relex,g=-1,y=b,_=0,v=0,x=0,S=null,O,$=null,ee=0,I=w?void 0:s.spec.def.first?.[e?0:1],q=I!=null&&I.alts===t&&I.n===p?I:void 0,j=null,C=Tr,V=0,H=0,K=h;for(o=0;o<p;){if(j==null&&q!=null){let F=m[0];if(F!=null&&b!==F&&h!==F.tin){for(K=F.tin,j=q.byTin.get(K)??Tr,C=q.wild,V=0,H=0;V<j.length&&j[V]<o;)V++;for(;H<C.length&&C[H]<o;)H++}}if(j!=null){let F=V<j.length?j[V]:p,Y=H<C.length?C[H]:p;if(F>=p&&Y>=p){o=p,c=!1,a=null;break}F<Y?(o=F,V++):(o=Y,H++)}a=t[o];let Z=0;c=!0,g=-1;let he=a.S,ve=a.sN|0;for(let F=0;F<ve;F++){let Y=m[F];if(Y==null||b===Y){let de=!1;do if(de=!1,Y=n.next(s,a,o,F),r.tC++,h===Y.tin&&!w){let me={};Y.use!=null&&(me.use=Y.use);let le=r.cfg.parse.recover;if(le.enabled){let ke=new Xt.TabnasError(Y.why||d,me,Y,s,r),Ae=r._badTo,Ke=r._badErr,Nt=r._recoverAt;if(Ae!=null&&Y.sI<=Ae&&Ke!=null&&r.errs[r.errs.length-1]===ke){if(r.errs.pop(),Ke.recovered.skipped++,le.maxSkip<Ke.recovered.skipped)throw ke}else Nt!=null&&r.vAbs-Nt<le.suppress&&r.errs[r.errs.length-1]===ke?(r.errs.pop(),r._badErr=null):(ke.recovered={skipped:1,bad:!0},r._badErr=ke,r._recoverAt=r.vAbs);if(r._badTo=Y.sI+Math.max(1,Y.len|0),le.maxRecoveries<r.errs.length)throw ke;qr(n,Y,Br[Y.why]===!0),de=!0;continue}throw new Xt.TabnasError(Y.why||d,me,Y,s,r)}while(de||u[Y.tin]);m[F]=Y}let Me=he?he[F]:null,Ue=h===Y.tin;if(Ue||Me!=null){let de=!1;if(!Ue&&Me!=null){let me=Y.tin,le=me/31|0,ke=le===0?f:0;de=(Me[le]&(1<<me%31-1|ke))!==0}if(!de){let me;if(w&&0<Y.len){let le=a.t[F];le!=null&&0<le.length&&(me=n.relex(Y,le,s))}if(me==null){c=!1;break}if(g===-1){let le=n.relexUndo;g=F,y=Y,$=m.slice(),_=le.sI,v=le.rI,x=le.cI,S=le.token,O=le.end}m[F]=me;for(let le=F+1;le<m.length;le++)m[le]=b}}Z=F+1}if(c){if(e){s.oN=Z;for(let F=0;F<Z;F++)s.o[F]=m[F];for(let F=Z;F<s.o.length;F++)s.o[F]=b}else{s.cN=Z;for(let F=0;F<Z;F++)s.c[F]=m[F];for(let F=Z;F<s.c.length;F++)s.c[F]=b}a.c&&(c=a.c(s,r,i))}if(c)break;if(Z>ee&&(ee=Z),a=null,g!==-1){n.unrelex(_,v,x,S,O);let F=$;m.length=F.length;for(let Y=0;Y<F.length;Y++)m[Y]=F[Y];r.sub.lex&&r.sub.lex.map(Y=>Y(y,s,r)),g=-1}let Ie=q!=null&&q!==s.spec.def.first?.[e?0:1];if(Ie&&(q=void 0),j==null)o++;else{let F=m[0];(Ie||F==null||b===F||K!==F.tin)&&(j=null,o++)}}if(!c){let Z=m[0];r._eMax=ee;{let he=new Set;for(let ve=0;ve<p;ve++){let Ie=t[ve],F=Ie.sN|0,Y=0;for(;Y<F;){let Me=m[Y];if(Me==null||b===Me)break;let Ue=Ie.S?Ie.S[Y]:null;if(Ue!=null){let de=Me.tin,me=de/31|0,le=me===0?f:0;if((Ue[me]&(1<<de%31-1|le))===0)break}Y++}if(Y<F){let Me=Ie.t?.[Y]??[];for(let Ue of Me)he.add(Ue)}}r._contTins=[...he]}if(w&&Z!=null&&h===Z.tin&&!r.cfg.parse.recover.enabled){let he={};throw Z.use!=null&&(he.use=Z.use),new Xt.TabnasError(Z.why||d,he,Z,s,r)}i.e=m[0]??b}a&&(i.n=a.n!=null?a.n:i.n,i.h=a.h!=null?a.h:i.h,i.a=a.a!=null?a.a:i.a,i.u=a.u!=null?a.u:i.u,i.k=a.k!=null?a.k:i.k,i.g=a.g!=null?a.g:i.g,i.ef=a.e||void 0,i.p=a.p!=null&&a.p!==!1?typeof a.p=="string"?a.p:a.p(s,r,i):i.p,i.r=a.r!=null&&a.r!==!1?typeof a.r=="string"?a.r:a.r(s,r,i):i.r,i.b=a.b!=null&&a.b!==!1?typeof a.b=="number"?a.b:a.b(s,r,i):i.b);let re=o<t.length;return r.log&&r.log(_e.S.parse,r,s,n,re,c,o,a,i),i}var wo=(e,t)=>e.filter(n=>31*t<=n&&n<31*(t+1)),yo=(e,t)=>e.reduce((n,s)=>1<<s-(31*t+1)|n,0),gs=/^[a-z][a-z0-9-]+$/;function Kt(e,t,n){ce.STRING===typeof e.g?e.g=e.g.split(/\s*,\s*/):e.g==null&&(e.g=[]);for(let r of e.g)if(!gs.test(r))throw new Error(`Grammar: invalid group tag "${r}" in rule ${n.name} (${t}) \u2014 must match ${gs}`);e.g=e.g.sort();let s=e;if(!e.s||e.s.length===0)e.s=null,s.t=[],s.S=null,s.sN=0;else{let r=l=>l.flat().map(f=>typeof f=="string"?f.split(/\s* +\s*/):f).flat().map(f=>typeof f=="string"?n.ji.tokenSet(f)??n.ji.token(f):f).flat().filter(f=>typeof f=="number");typeof e.s=="string"&&(e.s=e.s.split(/\s* +\s*/));let i=e.s.length,a=new Array(i),o=new Array(i);for(let l=0;l<i;l++){let c=r([e.s[l]]);a[l]=c;let f=n.ji.token("#AA");if(f!=null&&c.includes(f)){o[l]=null;continue}o[l]=0<c.length?new Array(Math.max(...c.map(u=>1+u/31|0))).fill(null).map((u,h)=>h).map(u=>yo(wo(c,u),u)):null}s.t=a,s.S=o,s.sN=i}if(e.p?Ot("push",t,n,e,"p"):e.p=null,e.r?Ot("replace",t,n,e,"r"):e.r=null,e.b?Ot("back",t,n,e,"b"):e.b=null,e.a?(xo(n,e),Ot("action",t,n,e,"a")):e.a=null,e.h?Ot("modify",t,n,e,"h"):e.h=null,e.e?Ot("error",t,n,e,"e"):e.e=null,!e.c)e.c=null;else{let r=typeof e.c;if(r==="string")Ot("condition",t,n,e,"c");else if(r==="function")e.c.name==="c"&&(0,_e.defprop)(e.c,"name",{value:"ruleCond"});else if(r==="object"){let i=e.c,a=[],o=Object.keys(e.c);for(let l of o){let c=i[l];if(c!=null){let f=Ur(l,c);if(0<f.length){let u=(n?.name??"?")+"."+(ce.OPEN===t?"open":"close");throw new Error("tabnas: "+u+": "+f.join("; "))}if(typeof c=="object")for(let u of Object.keys(c))a.push(Pr(u,l,c[u]));else a.push(Pr("$eq",l,c))}}a.length===0?delete e.c:a.length===1?e.c=a[0]:e.c=function(c,f,u){for(let h of a)if(h(c,f,u)==!1)return!1;return!0}}else throw new Error("Grammar: invalid condition: "+e.c)}return e}function bs(e){return typeof e=="string"&&e.startsWith("@")}function xo(e,t){let n=[],s=r=>{if(!bs(r))return r;let i=Ar.BUILTIN_CONFIG_FACTORY[r];if(i==null||e.def.fnref[r]!==Ar.BUILTIN_REFS[r])return r;let a=r.slice(1),o=i(t.k&&t.k[a]||{});return t.k&&a in t.k&&n.push(a),o};if((0,_e.isarr)(t.a)?t.a=t.a.map(s):t.a=s(t.a),t.k!=null&&0<n.length){for(let r of n)delete t.k[r];Object.keys(t.k).length===0&&(t.k=void 0)}}function Ot(e,t,n,s,r){let i=s[r];if(r==="a"&&Array.isArray(i)){if(i.length===0){s[r]=null;return}let a=i.map(o=>{if(bs(o)){let l=n.def.fnref[o];if(l==null)throw new Error(`Grammar: unknown ${e} function reference: `+o+` for rule ${n.name} (${t}) and alt ${s.s} (${s.g})`);return l}return o});s[r]=function(l,c,f){let u;for(let h of a)if(u=h(l,c,f),u&&u.isToken&&u.err)return u;return u};return}if(bs(i)){let a=n.def.fnref[i];if(a==null)throw new Error(`Grammar: unknown ${e} function reference: `+i+` for rule ${n.name} (${t}) and alt ${s.s} (${s.g})`);s[r]=a}}var Mr={$eq:1,$ne:1,$lt:1,$lte:1,$gt:1,$gte:1,$exist:1},Cr={n:1,u:1,k:1,d:1,i:1,name:1,state:1,node:1,need:1,oN:1,cN:1,o:1,c:1,o0:1,o1:1,c0:1,c1:1,parent:1,child:1,prev:1,next:1,spec:1};function Gr(e){let t=[];if(e==null||typeof e!="object")return t;if(e.c!=null&&typeof e.c=="object"&&typeof e.c!="function")for(let n of Object.keys(e.c)){let s=e.c[n];s!=null&&t.push(...Ur(n,s))}if(e.g!=null){let n=typeof e.g=="string"?e.g.split(","):e.g;if(Array.isArray(n))for(let s of n)typeof s=="string"&&!gs.test(s.trim())&&t.push('invalid group tag: "'+s+'"')}return t}function vo(e,t=""){let n=[],s=t?t+" ":"";if(!Array.isArray(e))return n;for(let r=0;r<e.length;r++)for(let i of Gr(e[r]))n.push(s+"alt["+r+"]: "+i);return n}function So(e){if(Array.isArray(e))return e;if(e!=null&&typeof e=="object"&&Array.isArray(e.alts))return e.alts}function _o(e,t){if(!(e==null||e===!1||typeof e!="string"||e==="")&&!e.startsWith("@"))return t.has(e)?void 0:e}function Eo(e,t){let n=[];if(e==null||typeof e!="object"||e.rule==null||typeof e.rule!="object")return n;let s=new Set(e.clear?[]:t||[]);for(let r of Object.keys(e.rule))e.rule[r]==null?s.delete(r):s.add(r);for(let r of Object.keys(e.rule)){let i=e.rule[r];if(!(i==null||typeof i!="object"))for(let a of["open","close"]){let o=So(i[a]);if(o==null)continue;let l=r+"."+a;for(let c=0;c<o.length;c++){let f=o[c];if(!(f==null||typeof f!="object"))for(let u of["p","r"]){let h=_o(f[u],s);h!==void 0&&n.push(l+" alt["+c+"]: unknown rule in "+u+': "'+h+'"')}}}}return n.sort(),n}function Ur(e,t){let n=[],s=e.split(".")[0];if(Cr[s]!==1&&n.push('unknown condition path: "'+e+'" (no rule property "'+s+'"); known roots: '+Object.keys(Cr).join(", ")),t!=null&&typeof t=="object")for(let r of Object.keys(t))Mr[r]!==1&&n.push("unknown condition operator: "+r+' (on "'+e+'"); known operators: '+Object.keys(Mr).join(", "));return n}function Pr(e,t,n){let s=t.split("."),r=s[0]==="n"&&s.length===2&&typeof n=="number",i=a=>{let o=(0,_e.getpath)(a,s);return o==null&&r?0:o};if(e==="$eq")return function(o,l,c){return i(o)===n};if(e==="$ne")return function(o,l,c){return i(o)!=n};if(e==="$lt")return function(o,l,c){let f=i(o);return f==null||f<n};if(e==="$lte")return function(o,l,c){let f=i(o);return f==null||f<=n};if(e==="$gt")return function(o,l,c){let f=i(o);return f==null||f>n};if(e==="$gte")return function(o,l,c){let f=i(o);return f==null||f>=n};if(e==="$exist")return function(o,l,c){let f=(0,_e.getpath)(o,s);return n===!0?f!=null:f==null};throw new Error("Grammer: unknown comparison operator: "+e)}});var Dr=xe(Ye=>{"use strict";Object.defineProperty(Ye,"__esModule",{value:!0});Ye.makeParser=Ye.makeRuleSpec=Ye.makeRule=Ye.Parser=void 0;var zt=vt(),Oo=Or(),Ne=St(),Je=Gt(),Rn=qt(),He=ks();Object.defineProperty(Ye,"makeRule",{enumerable:!0,get:function(){return He.makeRule}});Object.defineProperty(Ye,"makeRuleSpec",{enumerable:!0,get:function(){return He.makeRuleSpec}});var Mn=class e{#e;#t;constructor(t,n,s){this.rsm=Object.create(null),this.options=t,this.cfg=n,this.ji=s}rule(t,n){if(t==null)return this.rsm;let s=this.rsm[t];if(n===null)delete this.rsm[t];else if(n!==void 0){s=this.rsm[t]=this.rsm[t]||(0,He.makeRuleSpec)(this.ji,this.cfg,{}),s.name=t,s=this.rsm[t]=n(this.rsm[t],this)||this.rsm[t];return}return s}start(t,n,s,r){let i,a=(0,Rn.makeToken)("#ZZ",(0,Ne.tokenize)("#ZZ",this.cfg),void 0,zt.EMPTY,(0,Rn.makePoint)(-1)),o=(0,Ne.tokenize)("#BD",this.cfg),l=(0,Rn.makeNoToken)(),c=new Oo.Context({opts:this.options,cfg:this.cfg,meta:s||{},src:()=>t,root:()=>i,plgn:()=>n.internal().plugins,inst:()=>n,sub:n.internal().sub,rsm:this.rsm,F:this.#t??=(0,Ne.srcfmt)(this.cfg),NOTOKEN:l,NORULE:{}});r!=null&&((0,Ne.deep)(c,r),c.errs=[]);let f=(0,He.makeRule)(this.#e??=(0,He.makeRuleSpec)(this.ji,this.cfg,{}),c);c.NORULE=f,c.rule=f,s&&Ne.S.function===typeof s.log&&(c.log=s.log),this.cfg.parse.prepare.forEach(v=>v(n,c,s));let u=this.cfg.parse.recover.enabled;if(t===""){if(this.cfg.lex.empty)return u?{value:this.cfg.lex.emptyResult,errors:c.errs}:this.cfg.lex.emptyResult;{let v=new Je.TabnasError(Ne.S.unexpected,{src:t},c.t0,f,c);if(u)return{value:void 0,errors:c.errs};throw v}}let h=(0,Rn.makeLex)(c);c.lex=h;let d=this.rsm[this.cfg.rule.start];if(d==null)return u?{value:void 0,errors:c.errs}:void 0;let p=(0,He.makeRule)(d,c);i=p;let b=0;for(let v in this.rsm)b++;let m=c.cfg.rule.maxmul;0<m||(m=3);let w=2*b*h.src.length*2*m;w<100&&(w=100);let g=0,y=this.cfg.parse.budget.checkEveryN,_=this.cfg.parse.budget.onCheck;try{for(;f!==p&&g<w;){if(c.kI=g,c.rule=p,y&&_!=null&&g%y===0&&0<g&&_(c)===!1)throw new Je.TabnasError("cancel",{},c.t0,p,c);c.log&&c.log(Ne.S.step,c.kI+":"),c.sub.rule&&c.sub.rule.map(I=>I(p,c));let $=p,ee=p.state;if(p=p.process(c,h),c.sub.ruleDone){let I=(0,He.publishedHistoryChildSnapshot)($,c),q=c._dalt,j={state:ee,alt:q==null?null:{b:q.b||0,g:q.g?q.g.slice():[],p:q.p||zt.EMPTY,r:q.r||zt.EMPTY,err:q.e}};c.sub.ruleDone.map(C=>C($,c,j)),(0,He.refreshHistoryChild)($,c,I)}c.log&&c.log(Ne.S.stack,c,p,h),g++}let v=c.t[0];if(v!=null&&l.tin!==v.tin&&a.tin!==v.tin){if(o===v.tin){let $={};throw v.use!=null&&($.use=v.use),new Je.TabnasError(v.why||Ne.S.unexpected,$,v,p,c)}throw new Je.TabnasError(Ne.S.unexpected,{},v,f,c)}let x=this.cfg.tokenSetTins.IGNORE,S=h.next(p);for(;x[S.tin];)S=h.next(p);if(o===S.tin){let $={};throw S.use!=null&&($.use=S.use),new Je.TabnasError(S.why||Ne.S.unexpected,$,S,p,c)}if(a.tin!==S.tin)throw new Je.TabnasError(Ne.S.unexpected,{},S,f,c);let O=c.root().node;if(this.cfg.result.fail.includes(O))throw new Je.TabnasError(Ne.S.unexpected,{},c.t0,f,c);return u?{value:O,errors:c.errs}:O}catch(v){if(c.sub.ruleDone&&v instanceof Je.TabnasError)try{let x=c.rule;if(x!=null&&f!==x){let S=(0,He.publishedHistoryChildSnapshot)(x,c),O=c._dalt,$={state:x.state,alt:O==null?null:{b:O.b||0,g:O.g?O.g.slice():[],p:O.p||zt.EMPTY,r:O.r||zt.EMPTY,err:O.e??v.internal?.token}};c.sub.ruleDone.map(ee=>ee(x,c,$)),(0,He.refreshHistoryChild)(x,c,S)}}catch{}if(u&&v instanceof Je.TabnasError){let x;try{if(x=c.root()?.node,x==null){for(let S=0;S<c.rsI;S++){let O=c.rs[S]?.node;if(O!=null){x=O;break}}x==null&&(x=c.rule?.node??void 0)}}catch{}return{value:x,errors:c.errs}}throw v}}clone(t,n,s){let r=new e(t,n,s);return r.rsm=Object.keys(this.rsm).reduce((i,a)=>(i[a]=(0,Ne.filterRules)(this.rsm[a],this.cfg),i),Object.create(null)),r.norm(),r}norm(){(0,Ne.values)(this.rsm).map(t=>t.norm())}};Ye.Parser=Mn;var Ao=(...e)=>new Mn(...e);Ye.makeParser=Ao});var Wr=xe(Pn=>{"use strict";Object.defineProperty(Pn,"__esModule",{value:!0});Pn.mergeInstances=Po;Pn.deshareMatchTokens=Vr;var Io=us();function Mt(e){if(e==null||typeof e!="object"||Array.isArray(e))return!1;let t=Object.getPrototypeOf(e);return t===null||t===Object.prototype}function pt(e,t){if(Object.is(e,t))return!0;if(e instanceof RegExp&&t instanceof RegExp)return e.source===t.source&&e.flags===t.flags;if(Array.isArray(e)&&Array.isArray(t))return e.length===t.length&&e.every((n,s)=>pt(n,t[s]));if(Mt(e)&&Mt(t)){let n=Object.keys(e),s=Object.keys(t);return n.length===s.length&&n.every(r=>pt(e[r],t[r]))}return!1}function zr(e,t,n,s){if(e===void 0)return t;if(t===void 0)return e;if(Mt(e)&&Mt(t)){let r={},i=Object.keys(t),a=[...Object.keys(e),...i.filter(o=>!(o in e))];for(let o of a){let l=zr(e[o],t[o],Mt(n)?n[o]:void 0,[...s,o]);l!==void 0&&(r[o]=l)}return r}if(pt(e,t))return e;if(pt(e,n))return t;if(pt(t,n))return e;throw new Error("merge: conflicting option values at "+s.join("."))}function jo(e){let t=e.fixed?.token;if(t==null)return;let n={};for(let s of Object.keys(t)){let r=t[s];if(n[r]!=null&&n[r]!==s)throw new Error("merge: fixed tokens "+n[r]+" and "+s+" both claim source "+JSON.stringify(r));n[r]=s}}function Vr(e){let t=e.match?.token;if(t==null)return;let n={};for(let s of Object.keys(t)){let r=t[s];if(r instanceof RegExp){let i=new RegExp(r.source,r.flags);r.eager$&&(i.eager$=!0),n[s]=i}else if(typeof r=="function"){let i=(a,o,l)=>r(a,o,l);r.eager$&&(i.eager$=!0),n[s]=i}else n[s]=r}e.match.token=n}function No(e){let t=e.lex?.match;if(t==null)return;let n=Object.keys(t).sort((r,i)=>{let a=t[r]?.order??0,o=t[i]?.order??0;return a!==o?a-o:r<i?-1:r>i?1:0}),s={};for(let r of n)s[r]=t[r];e.lex.match=s}function $o(e,t){let n=s=>{let r=t.t[s];if(r==null)throw new Error("merge: unknown token tin: "+s);return r};return typeof e=="number"?n(e):Array.isArray(e)?e.map(s=>typeof s=="number"?n(s):s):e}function To(e){return[e.c?1:0,e.e?1:0,e.h?1:0,e.b?1:0,e.n?Object.keys(e.n).length:0,e.a?1:0,e.u?1:0,e.k?1:0,e.p?1:0,e.r?1:0]}function Ro(e){return(e||[]).map(t=>(Array.isArray(t)?t:[t]).flatMap(n=>n==null?[]:typeof n=="string"?n.split(/\s* +\s*/):[String(n)]).filter(n=>n!=="").sort().join(" "))}function Kr(e,t,n){let r=(e.t||[]).map(a=>a.map(o=>t.t[o]).sort().join(" ")),i={...e};return delete i.t,delete i.S,delete i.sN,i.s=e.s&&e.s.length?e.s.map(a=>$o(a,t)):null,i.g=[...e.g||[]],e.n&&(i.n={...e.n}),e.u&&(i.u={...e.u}),e.k&&(i.k={...e.k}),{alt:i,keys:r,names:Ro(i.s),complexity:To(e),gkey:(e.g||[]).join(","),tag:n}}function Mo(e,t){let n=Math.min(e.keys.length,t.keys.length);for(let s=0;s<n;s++)if(e.keys[s]!==t.keys[s])return e.keys[s]<t.keys[s]?-1:1;if(e.keys.length!==t.keys.length)return t.keys.length-e.keys.length;for(let s=0;s<e.complexity.length;s++){let r=t.complexity[s]-e.complexity[s];if(r!==0)return r}return e.gkey!==t.gkey?e.gkey<t.gkey?-1:1:e.tag<t.tag?-1:e.tag>t.tag?1:0}function At(e,t){return e===t?!0:typeof e=="function"&&typeof t=="function"&&e.toString()===t.toString()}function Co(e,t){return e.keys.length!==t.keys.length||!e.keys.every((n,s)=>n===t.keys[s])||e.names.length!==t.names.length||!e.names.every((n,s)=>n===t.names[s])||e.gkey!==t.gkey||e.alt.c!==t.alt.c&&(e.alt.c||t.alt.c)?!1:At(e.alt.a,t.alt.a)&&At(e.alt.h,t.alt.h)&&At(e.alt.e,t.alt.e)&&(e.alt.b===t.alt.b||At(e.alt.b,t.alt.b))&&(e.alt.p===t.alt.p||At(e.alt.p,t.alt.p))&&(e.alt.r===t.alt.r||At(e.alt.r,t.alt.r))&&pt(e.alt.n,t.alt.n)&&pt(e.alt.u,t.alt.u)&&pt(e.alt.k,t.alt.k)}function Xr(e,t){let n=t.filter(a=>!e.some(o=>Co(o,a))),s=[],r=0,i=0;for(;r<e.length&&i<n.length;)Mo(e[r],n[i])<=0?s.push(e[r++]):s.push(n[i++]);for(;r<e.length;)s.push(e[r++]);for(;i<n.length;)s.push(n[i++]);return s}function Hr(e,t){let n=e.internal(),s=n.config,r=n.parser.rule(),i={};for(let a of Object.keys(r)){let o=r[a].def,l={};for(let c of Object.keys(o.fnref))c.includes("$")?l[c]=o.fnref[c]:l["@"+t+":"+c.substring(1)]=o.fnref[c];i[a]={fnref:l,bo:[...o.bo],ao:[...o.ao],bc:[...o.bc],ac:[...o.ac],open:o.open.map(c=>Kr(c,s,t)),close:o.close.map(c=>Kr(c,s,t))}}return i}function Cn(e,t){let n=[...e];for(let s of t)n.some(r=>At(r,s))||n.push(s);return n}function Yr(e){let t={...e};return t.s=Array.isArray(e.s)?[...e.s]:e.s,t.g=[...e.g||[]],e.n&&(t.n={...e.n}),e.u&&(t.u={...e.u}),e.k&&(t.k={...e.k}),t}function Po(e,t,n){let s=(x,S)=>{let O=x.internal().merged.tag;if(O==null||O===""||O==="-")throw new Error("merge: the "+S+" instance needs a tag option (used to prefix its named actions)");return String(O)},r=s(e,"first"),i=s(t,"second");if(r===i)throw new Error("merge: instance tags must differ, both are "+JSON.stringify(r));let[a,o]=r<i?[e,t]:[t,e],[l,c]=r<i?[r,i]:[i,r],f=x=>{let{tag:S,plugins:O,...$}=x;return Mt($.rule)&&$.rule.history===!1?{...$,rule:{...$.rule,history:null}}:$},u=zr(f(a.internal().merged),f(o.internal().merged),Io.defaults,[]);u.tag=l+"~"+c,jo(u),Vr(u),No(u);let h=Hr(a,l),d=Hr(o,c),p=[...Object.keys(h),...Object.keys(d).filter(x=>!(x in h))].sort(),b={fnref:{},bo:[],ao:[],bc:[],ac:[],open:[],close:[]},m={};for(let x of p){let S=h[x]||b,O=d[x]||b;m[x]={fnref:{...S.fnref,...O.fnref},bo:Cn(S.bo,O.bo),ao:Cn(S.ao,O.ao),bc:Cn(S.bc,O.bc),ac:Cn(S.ac,O.ac),open:Xr(S.open,O.open),close:Xr(S.close,O.close)}}let w=function(x){for(let S of p){let O=m[S];x.rule(S,$=>{Object.assign($.def.fnref,O.fnref),$.def.bo.push(...O.bo),$.def.ao.push(...O.ao),$.def.bc.push(...O.bc),$.def.ac.push(...O.ac),0<O.open.length&&$.open(O.open.map(ee=>Yr(ee.alt)),{append:!0}),0<O.close.length&&$.close(O.close.map(ee=>Yr(ee.alt)),{append:!0})})}};Object.defineProperty(w,"name",{value:"merged"});let g=n(u);g.use(w);let y=g.internal().sub,_=a.internal().sub,v=o.internal().sub;for(let x of["lex","rule","ruleDone"]){let S=[..._[x]||[],...v[x]||[]];0<S.length&&(y[x]=[...y[x]||[],...S])}return g}});var _t=xe(P=>{"use strict";Object.defineProperty(P,"__esModule",{value:!0});P.validateGrammar=P.validateAlts=P.validateAlt=P.makeToken=P.makeTextMatcher=P.makeStringMatcher=P.makeSpaceMatcher=P.makeRuleSpec=P.makeRule=P.makePoint=P.makeParser=P.makeNumberMatcher=P.makeLineMatcher=P.makeLex=P.makeFixedMatcher=P.makeCommentMatcher=P.util=P.S=P.SKIP=P.MAX_RULE_HISTORY=P.EMPTY=P.AFTER=P.BEFORE=P.CLOSE=P.OPEN=P.BUILTIN_SCHEMA_VERSION=P.BUILTIN_REFS=P.TabnasError=P.Tabnas=P.keyOrder=P.VERSION=void 0;var Pe=vt();Object.defineProperty(P,"OPEN",{enumerable:!0,get:function(){return Pe.OPEN}});Object.defineProperty(P,"CLOSE",{enumerable:!0,get:function(){return Pe.CLOSE}});Object.defineProperty(P,"BEFORE",{enumerable:!0,get:function(){return Pe.BEFORE}});Object.defineProperty(P,"AFTER",{enumerable:!0,get:function(){return Pe.AFTER}});Object.defineProperty(P,"EMPTY",{enumerable:!0,get:function(){return Pe.EMPTY}});Object.defineProperty(P,"MAX_RULE_HISTORY",{enumerable:!0,get:function(){return Pe.MAX_RULE_HISTORY}});Object.defineProperty(P,"SKIP",{enumerable:!0,get:function(){return Pe.SKIP}});var G=St();Object.defineProperty(P,"keyOrder",{enumerable:!0,get:function(){return G.keyOrder}});Object.defineProperty(P,"S",{enumerable:!0,get:function(){return G.S}});var Vt=fs();Object.defineProperty(P,"BUILTIN_REFS",{enumerable:!0,get:function(){return Vt.BUILTIN_REFS}});Object.defineProperty(P,"BUILTIN_SCHEMA_VERSION",{enumerable:!0,get:function(){return Vt.BUILTIN_SCHEMA_VERSION}});var Qe=Gt();Object.defineProperty(P,"TabnasError",{enumerable:!0,get:function(){return Qe.TabnasError}});var ws=us(),ye=qt();Object.defineProperty(P,"makeCommentMatcher",{enumerable:!0,get:function(){return ye.makeCommentMatcher}});Object.defineProperty(P,"makeFixedMatcher",{enumerable:!0,get:function(){return ye.makeFixedMatcher}});Object.defineProperty(P,"makeLex",{enumerable:!0,get:function(){return ye.makeLex}});Object.defineProperty(P,"makeLineMatcher",{enumerable:!0,get:function(){return ye.makeLineMatcher}});Object.defineProperty(P,"makeNumberMatcher",{enumerable:!0,get:function(){return ye.makeNumberMatcher}});Object.defineProperty(P,"makePoint",{enumerable:!0,get:function(){return ye.makePoint}});Object.defineProperty(P,"makeSpaceMatcher",{enumerable:!0,get:function(){return ye.makeSpaceMatcher}});Object.defineProperty(P,"makeStringMatcher",{enumerable:!0,get:function(){return ye.makeStringMatcher}});Object.defineProperty(P,"makeTextMatcher",{enumerable:!0,get:function(){return ye.makeTextMatcher}});Object.defineProperty(P,"makeToken",{enumerable:!0,get:function(){return ye.makeToken}});var Wt=Dr();Object.defineProperty(P,"makeParser",{enumerable:!0,get:function(){return Wt.makeParser}});Object.defineProperty(P,"makeRule",{enumerable:!0,get:function(){return Wt.makeRule}});Object.defineProperty(P,"makeRuleSpec",{enumerable:!0,get:function(){return Wt.makeRuleSpec}});var Zt=ks();Object.defineProperty(P,"validateAlt",{enumerable:!0,get:function(){return Zt.validateAlt}});Object.defineProperty(P,"validateAlts",{enumerable:!0,get:function(){return Zt.validateAlts}});Object.defineProperty(P,"validateGrammar",{enumerable:!0,get:function(){return Zt.validateGrammar}});var Zr=Wr(),ys={keyOrder:G.keyOrder,recordKeyOrder:G.recordKeyOrder,KEY_ORDER:G.KEY_ORDER,badlex:G.badlex,charset:G.charset,clean:G.clean,clone:G.clone,configure:G.configure,deep:G.deep,entries:G.entries,errdesc:Qe.errdesc,errinject:Qe.errinject,errmsg:Qe.errmsg,errsite:Qe.errsite,escre:G.escre,keys:G.keys,makelog:G.makelog,mesc:G.mesc,omap:G.omap,parserwrap:G.parserwrap,prop:Qe.prop,regexp:G.regexp,srcfmt:G.srcfmt,str:G.str,strinject:Qe.strinject,tokenize:G.tokenize,trimstk:Qe.trimstk,values:G.values,isMatcherToken:G.isMatcherToken,guardedMatcher:ye.guardedMatcher,scan:ye.scan,buildCharRunSpec:ye.buildCharRunSpec,buildLineRunSpec:ye.buildLineRunSpec,buildStringBodySpec:ye.buildStringBodySpec,CONSUME:ye.CONSUME,IS_ROW:ye.IS_ROW,CI_RESET:ye.CI_RESET,STOP:ye.STOP,STATE_MASK:ye.STATE_MASK};P.util=ys;var xs=class e{#e;#t;#s=-1;#n=0;#r=null;static{this.util=ys}static{this.S=G.S}static{this.OPEN=Pe.OPEN}static{this.CLOSE=Pe.CLOSE}static{this.BEFORE=Pe.BEFORE}static{this.AFTER=Pe.AFTER}static{this.EMPTY=Pe.EMPTY}static{this.SKIP=Pe.SKIP}constructor(t,n){let s=[],r={};if(t)if(Array.isArray(t.plugins)){s=t.plugins;let{plugins:l,...c}=t;r=c}else r=t;this.parent=n;let i={parser:void 0,config:void 0,plugins:[],sub:{lex:void 0,rule:void 0,ruleDone:void 0},mark:Math.random(),merged:void 0};this.#e=i,r&&(0,G.validateOptions)(r,ws.defaults);let a=(0,G.deep)({},n?{...n.#e.merged}:r.defaults$===!1?{}:ws.defaults,r||{});i.merged=a,this.id="Tabnas/"+Date.now()+"/"+(""+Math.random()).substring(2,8).padEnd(6,"0")+(a.tag==null?"":"/"+a.tag),this.token=(l=>i.config.fixed.token[l]??(0,G.tokenize)(l,i.config,this)),this.tokenSet=(l=>(0,G.findTokenSet)(l,i.config)),this.fixed=(l=>i.config.fixed.ref[l]);let o=(l=>(l!=null&&this.#n++,this.#a(l)));if((0,G.deep)(o,i.merged),(0,G.defprop)(this,"options",{value:o,writable:!0,enumerable:!0,configurable:!0}),n){let l=n.#e;i.config=(0,G.configure)(this,void 0,a),(0,G.assign)(this.token,i.config.t);for(let h of Object.keys(n))this[h]===void 0&&(this[h]=n[h]);i.parser=(0,Wt.makeParser)(a,i.config,this);let c=l.plugins;i.plugins=[];for(let h of c)this.use(h);let f=i.parser.rule(),u=Object.create(null);for(let h of Object.keys(f))u[h]=(0,G.filterRules)(f[h],i.config);i.parser.rsm=u,i.parser.norm()}else i.config=(0,G.configure)(this,void 0,a),i.parser=(0,Wt.makeParser)(a,i.config,this),(0,G.assign)(this.token,i.config.t);for(let l of s)this.use(l)}#a(t){return t!=null&&((0,G.validateOptions)(t,ws.defaults),(0,G.deep)(this.#e.merged,t),(0,G.configure)(this,this.#e.config,this.#e.merged),this.#e.parser=this.#e.parser.clone(this.#e.merged,this.#e.config,this),(0,G.deep)(this.options,this.#e.merged)),{...this.#e.merged}}parse(t,n,s){if(G.S.string===typeof t){let r=this.#e.parser,i=this.#e.merged.parser;return(i?.start?(0,G.parserwrap)(i):r).start(t,this,n,s)}return t}config(){return(0,G.deep)(this.#e.config)}use(t,n){if(this.#n++,G.S.function!==typeof t)throw new Error("Tabnas.use: the first argument must be a function defining a plugin.");let s=t.name.toLowerCase(),r=(0,G.deep)({},t.defaults||{},n||{});this.options({plugin:{[s]:r}});let i=this.#e.merged.plugin[s];return this.#e.plugins.push(t),t.options=i,t(this,i)||this}rule(t,n){n!==void 0&&this.#n++;let s=this.#e.parser.rule(t,n);return s===void 0?this:s}make(t){return new e(t,this)}merge(t){return(0,Zr.mergeInstances)(this,t,n=>new e(n))}empty(t){return new e({defaults$:!1,standard$:!1,grammar$:!1,...t||{}})}toString(){return this.id}sub(t){return t.lex&&(this.#e.sub.lex=this.#e.sub.lex||[],this.#e.sub.lex.push(t.lex)),t.rule&&(this.#e.sub.rule=this.#e.sub.rule||[],this.#e.sub.rule.push(t.rule)),t.ruleDone&&(this.#e.sub.ruleDone=this.#e.sub.ruleDone||[],this.#e.sub.ruleDone.push(t.ruleDone)),this}continuations(t){if(this.#t==null||this.#s!==this.#n){let l=this.make({parse:{recover:{enabled:!1}}}),c=this.#e.parser.rsm,f=l.internal().parser,u=!1;for(let d of Object.keys(c))f.rsm[d]==null&&(f.rsm[d]=(0,G.filterRules)(c[d],l.internal().config),u=!0);u&&f.norm();let h=l.token("#ZZ");l.sub({lex:(d,p,b)=>{if(h===d.tin)try{let m=0,w=b.t,g=b.NOTOKEN;for(;m<w.length&&w[m]!=null&&g!==w[m];)m++;let y=(0,Zt.continuationTins)(b,p,m),_=this.#r;this.#r=_==null?y:[...new Set([..._,...y])]}catch{}}}),this.#t=l,this.#s=this.#n}let n=this.#t;this.#r=null;let s;try{n.parse(t)}catch(l){if(l instanceof Qe.TabnasError)s=l;else throw l}if(s==null){let l=this.#r;if(l!=null){let f=new Set(l);f.add(n.token("#ZZ"));let u=[...f].sort((h,d)=>h-d);return{tins:u,tokens:u.map(h=>String(n.token(h)))}}let c=this.#i(n);return{tins:c,tokens:c.map(f=>String(n.token(f)))}}let r=s.internal?.ctx,i=s.internal?.rule??r?.rule,a=r!=null?(0,Zt.continuationTins)(r,i):[];a.length===0&&(a=this.#i(n));let o=a.map(l=>String(n.token(l)));return{tins:a,tokens:o}}#i(t){let n=t.internal().config,r=t.internal().parser.rsm[n.rule.start]?.def?.tcol?.[0]?.[0];return Array.isArray(r)?[...r].sort((i,a)=>i-a):[]}internal(){return this.#e}grammar(t,n){this.#n++,(0,G.rejectReservedNames)(t.options),t=(0,G.deep)({},t),t.options&&(0,Zr.deshareMatchTokens)(t.options);let s=n?.rule?.alt?.g,r=s==null?null:Array.isArray(s)?[...s]:String(s).split(/\s*,\s*/).filter(o=>o.length>0),i=o=>r==null||r.length===0||!Array.isArray(o)?o:o.map(l=>{if(l==null||G.S.object!==typeof l)return l;let c=l.g==null?[]:Array.isArray(l.g)?[...l.g]:String(l.g).split(/\s*,\s*/).filter(f=>f.length>0);return{...l,g:[...c,...r]}});if(t.v!=null){if(typeof t.v!="number"||!Number.isInteger(t.v)||t.v<1)throw new Error(`Grammar: invalid builtin schema version: ${t.v} (expected a positive integer)`);if(t.v>Vt.BUILTIN_SCHEMA_VERSION)throw new Error(`Grammar: requires builtin schema version ${t.v}, but this engine supports up to ${Vt.BUILTIN_SCHEMA_VERSION}`)}if(t.ref){for(let o of Object.keys(t.ref))if(o.includes("$"))throw new Error(`Grammar: '$' is reserved for engine builtins; user ref key '${o}' may not contain '$'`)}let a=Object.assign(Object.create(null),Vt.BUILTIN_REFS,t.ref||{});if(t.clear===!0){let o=this.#e.parser.rule();for(let f of(0,G.keys)(o))this.rule(f,null);let l=this.#e.config.fixed.token,c={};for(let f of(0,G.keys)(l)){let u=this.token(l[f]);u!=null&&(c[u]=null)}0<(0,G.keys)(c).length&&this.options({fixed:{token:c}})}if(t.options){let o=(0,G.resolveFuncRefs)(t.options,a);this.options(o)}if(t.rule)for(let o of Object.keys(t.rule)){let l=t.rule[o];if(l===null){this.rule(o,null);continue}this.rule(o,c=>{if(c.fnref(a),l.open){let f=Array.isArray(l.open),u=f?l.open:l.open.alts,h=f?{}:l.open.inject;c.open(i(u),h)}if(l.close){let f=Array.isArray(l.close),u=f?l.close:l.close.alts,h=f?{}:l.close.inject;c.close(i(u),h)}})}return this}get util(){return ys}};P.Tabnas=xs;var Fo="0.12.11";P.VERSION=Fo});var Ps=xe(fe=>{"use strict";Object.defineProperty(fe,"__esModule",{value:!0});fe.isProseName=fe.REMOVE_ALL=fe.REMOVE_PROSE=fe.MAX_EMIT_UNITS=fe.MAX_LEFT_RECURSION_ELEMENTS=fe.MAX_LEFT_RECURSION_EXPANSION=fe.MAX_REPEAT_EXPANSION=fe.BUILTIN_TOKENS=fe.EmitError=void 0;fe.diagName=z;fe.emitGrammarSpec=Cl;fe.eliminateLeftRecursion=Xo;fe.refsIn=nn;fe.escapeRegExp=Ai;fe.termKey=Oe;fe.isEffectivelyCaseSensitive=ln;fe.setMemoLimit=Ml;var Lo=_t(),gt=Symbol("elementSource");function Bo(e){let t=new Map(e.productions.map(i=>[i.name,i])),n=new Map,s=new Map;if(!e.productions.some(i=>i.value!=null))return{plan:n,collect:s};let r=fi(e.productions);for(let i of e.productions)if(!Ss(i,r))for(let a of i.alts){let o=a[0];if(o==null||o.kind!=="ref")continue;let l=ei(o.name,t).annotated;if(l!=null)throw new ae(`${z()}: rule '${i.name}' begins with '${o.name}', and '${l}' is folded into '${i.name}' by left-recursion elimination \u2014 which erases the value '${l}' is annotated to build, so nothing would produce it. Put a literal before '${o.name}', or remove the annotation on '${l}'.`,{rule:i.name,sp:i.sp})}for(let i of e.productions){let a=i.value;if(a==null)continue;let o={rule:i.name,sp:i.sp};if(a.kind!=="object"&&a.kind!=="array")throw new ae(`${z()}: rule '${i.name}' has a value annotation of unknown kind '${a.kind}'. A rule builds an 'object' or an 'array'.`,o);if(i.alts.length!==1)throw new ae(`${z()}: rule '${i.name}' has a value annotation and ${i.alts.length} alternatives. A value annotation names the parts of ONE alternative; with more than one it is ambiguous which alternative's parts are named. Split the rule, or annotate the alternatives' own rules.`,o);let l=a.members;if(l!=null&&!Array.isArray(l))throw new ae(`${z()}: rule '${i.name}' has a value annotation whose members are not a list. A value annotation names its members as a list of strings.`,o);if(l!=null){let d=new Set;for(let p of l){if(typeof p!="string"||p==="")throw new ae(`${z()}: rule '${i.name}' has a value annotation naming a member that is not a name (${JSON.stringify(p)}). Every member of an object is named by a non-empty string.`,o);if(d.has(p))throw new ae(`${z()}: rule '${i.name}' names the member '${p}' twice. Each member is a separate key, so the second part would overwrite the first. Give them different names.`,o);if(d.add(p),Jr===p)throw new ae(`${z()}: rule '${i.name}' names a member '${Jr}'. That name is how a value is told apart from a parse-tree node, so a value carrying it is mistaken for a node and dropped wherever an ordinary rule captures this one. Name the member something else.`,o)}}let c=i.alts[0];if(c.length===1&&c[0].kind==="prose")throw new ae(`${z()}: rule '${i.name}' has a value annotation, but its body is prose ('<${c[0].text}>'), which describes a built-in token rather than defining a rule \u2014 the rule is dropped, so nothing would build the value. Remove the annotation.`,o);let f=c.filter(oi);if(a.kind==="array"){if(l!=null&&0<l.length)throw new ae(`${z()}: rule '${i.name}' builds an array and names ${l.length} member${l.length===1?"":"s"}. An array's parts are positional and are not named; annotate it as an object to name them.`,o)}else{let d=l?.length??0;if(d!==f.length)throw new ae(`${z()}: rule '${i.name}' names ${d} member${d===1?"":"s"} but has ${f.length} part${f.length===1?" that produces":"s that produce"} a value. A value annotation names one member per part that produces a value; a literal produces no value and is not a member.`,o)}let u=c[0];if(u!=null&&u.kind==="ref"&&!Ss(i,r)&&!ei(u.name,t).ok)throw new ae(`${z()}: rule '${i.name}' names '${u.name}' as its first member, but '${u.name}' is folded into this rule by left-recursion elimination and its body is not a single part, so the member would not cover what the author wrote. Give '${u.name}' a body that is one part (a reference, a repetition or a group), or put a literal before it.`,o);let h=f.map(d=>d.kind==="ref"&&t.get(d.name)?.value!=null);f.forEach((d,p)=>{if(h[p])return;let b=ai(d,t,new Set);if(b==null||a.kind==="array"&&Qr(d)&&b!==i.name&&(b=vs(d,t),b==null))return;let m=a.kind==="array"?`element ${p+1}`:`member '${l?.[p]}'`;throw b===i.name?new ae(`${z()}: rule '${i.name}' takes ${m} as source text, but that part reaches '${i.name}' itself, which builds a value \u2014 a rule that builds a value contributes no text to the part above it, so a recursive rule cannot take its own repetition as text. Annotate the rule the recursion pushes instead.`,o):new ae(`${z()}: rule '${i.name}' takes ${m} as source text, but '${b}' is reached from it and builds a value of its own \u2014 a rule that builds a value contributes no text to the part above it, so the member would be missing '${b}'s match, or empty. Make that part '${b}' itself so it nests, or remove the annotation on '${b}'.`,o)}),n.set(i.name,h),a.kind==="array"&&s.set(i.name,f.map(Qr))}return{plan:n,collect:s}}var Jr="src",Bn="rep";function vs(e,t){switch(e.kind){case"ref":{let n=t.get(e.name);return n==null||n.value!=null?null:ai(e,t,new Set)}case"opt":case"star":case"plus":case"rep":return vs(e.inner,t);case"group":{for(let n of e.alts)for(let s of n){let r=vs(s,t);if(r!=null)return r}return null}default:return null}}function ai(e,t,n){let s=[e];for(;s.length>0;){let r=s.pop();switch(r.kind){case"ref":{let i=t.get(r.name);if(i==null)break;if(i.value!=null)return i.name;if(n.has(i.name))break;n.add(i.name);let a=i.alts.flat();for(let o=a.length-1;o>=0;o--)s.push(a[o]);break}case"opt":case"star":case"plus":case"rep":s.push(r.inner);break;case"group":{let i=r.alts.flat();for(let a=i.length-1;a>=0;a--)s.push(i[a]);break}default:break}}return null}function Ss(e,t){if(e.alts.length!==1||e.alts[0].length!==1)return!1;let n=e.alts[0][0];return n.kind!=="ref"?!1:!t.has(e.name)&&!t.has(n.name)}function oi(e){let t=e.kind;return t!=="term"&&t!=="regex"&&t!=="token"&&t!=="prose"}function Qr(e){let t=e.kind;return t==="star"||t==="plus"||t==="opt"||t==="rep"}function qo(e,t){let n=new Map(e.productions.map(a=>[a.name,a])),s=new Set,r=a=>{let o=n.get(a);if(!(o==null||o.nodeKind!=="helper"||s.has(a))){s.add(a);for(let l of o.alts)for(let c of l)c.kind==="ref"&&r(c.name)}},i=(a,o)=>{let l=n.get(a);if(l==null||o.has(a))return!1;o.add(a);for(let c of l.alts)for(let f of c){if(f.kind!=="ref")continue;let u=n.get(f.name);if(u==null||u.nodeKind!=="helper"||i(f.name,o))return!0}return!1};for(let a of e.productions){if(a.value?.kind!=="array")continue;let o=t.get(ne(a));if(o!=null)for(let l of a.alts){let c=0;for(let f of l)f.kind==="ref"&&(o[c]&&i(f.name,new Set)&&r(f.name),c++)}}return s}function ei(e,t){let n=new Set,s=t.get(e);for(;s!=null;){if(n.has(s.name))return{ok:!1};if(n.add(s.name),s.value!=null)return{ok:!1,annotated:s.name};if(s.alts.length!==1||s.alts[0].length!==1)return{ok:!1};let r=s.alts[0][0];if(!oi(r))return{ok:!1};if(r.kind!=="ref")return{ok:!0};s=t.get(r.name)}return{ok:!0}}function ne(e){return e.origin??e.name}function Go(e,t){return e[gt]??{rule:ne(t),sp:e.sp??t.sp}}function qn(e,t){return t[gt]&&(e[gt]=t[gt]),e}function Uo(e,t,n){return t!==void 0?qn(e,t):(e[gt]={rule:ne(n),sp:n.sp},e)}function _s(e,t){let n;return e.kind==="group"?n={...e,alts:e.alts.map(s=>s.map(r=>_s(r,t)))}:e.kind==="opt"||e.kind==="star"||e.kind==="plus"||e.kind==="rep"?n={...e,inner:_s(e.inner,t)}:n={...e},n[gt]=e[gt]??{rule:ne(t),sp:e.sp??t.sp},n}function li(e){return e.kind==="opt"?[e.inner]:e.kind==="star"?[e.inner,e]:e.kind==="rep"&&e.min===0?e.max===0?null:e.max===1/0?[e.inner,e]:e.max===1?[e.inner]:[e.inner,qn({kind:"rep",min:0,max:e.max-1,inner:e.inner},e)]:null}function Do(e,t){let n=!1;for(let s of e){if(s.kind==="ref")return n&&s.name===t;if(li(s)===null)return!1;n=!0}return!1}function Ko(e,t){return e.map(n=>{let s=n.alts,r=s.reduce((i,a)=>i+a.length,0)+1;for(let i=0;i<r;i++){let a=s.findIndex(c=>Do(c,n.name));if(a<0)break;let o=s[a],l=li(o[0]);t.added=Wo(n,o,l,t.added),s=[...s.slice(0,a),[...l,...o.slice(1)],o.slice(1),...s.slice(a+1)]}return s===n.alts?n:{...n,alts:s}})}function ci(e,t=new Set){let n=e.productions.map(u=>u.name),s=new Set,r={added:0},i=Ho(Ko(e.productions.map(u=>({name:u.name,alts:u.alts.map(h=>h.map(d=>_s(d,u))),nodeKind:u.nodeKind,origin:u.origin,sp:u.sp,value:u.value})),r)),a=fi(i),o=u=>Ss(u,a),l=r.added;for(let u=0;u<i.length;u++){if(!o(i[u])){let h=0,d=i.length+1;for(let p=0;p<d;p++){let b=!1;for(let m=0;m<u;m++)Yo(i[u],i[m].name)&&(t.has(i[m].name)?i[u]=Jo(i[u],i[m].name):(h=zo(i[u],i[m],h),l=Vo(i[u],i[m],l),i[u]=Zo(i[u],i[m])),b=!0);if(!b)break}}i[u]=tl(i[u],s)}let c=new Map(i.map(u=>[u.name,u])),f=[];for(let u of n){let h=c.get(u);h&&(f.push(h),c.delete(u))}for(let u of c.values())f.push(u);return{productions:f}}function Xo(e,t=new Set){let n=ci(e,t),s=r=>{if(delete r[gt],r.kind==="group")for(let i of r.alts)for(let a of i)s(a);else(r.kind==="opt"||r.kind==="star"||r.kind==="plus"||r.kind==="rep")&&s(r.inner)};for(let r of n.productions)for(let i of r.alts)for(let a of i)s(a);return n}function fi(e){let t=new Map(e.map(u=>[u.name,u])),n=u=>{let h=[];for(let d of u.alts){if(d.length===0)continue;let p=d[0];p.kind==="ref"&&t.has(p.name)&&h.push(p.name)}return h},s=0,r=[],i=new Set,a=new Map,o=new Map,l=new Set,c=u=>{a.set(u,s),o.set(u,s),s++,r.push(u),i.add(u);let h=t.get(u);return{name:u,targets:h?n(h):[],next:0}};function f(u){let h=[c(u)];for(;h.length>0;){let d=h[h.length-1];if(d.next<d.targets.length){let m=d.targets[d.next++];a.has(m)?i.has(m)&&o.set(d.name,Math.min(o.get(d.name),a.get(m))):h.push(c(m));continue}h.pop();let p=d.name;if(o.get(p)===a.get(p)){let m=[],w;do w=r.pop(),i.delete(w),m.push(w);while(w!==p);if(m.length>1||m.length===1&&n(t.get(m[0])).includes(m[0]))for(let y of m)l.add(y)}let b=h[h.length-1];b&&o.set(b.name,Math.min(o.get(b.name),o.get(p)))}}for(let u of e)a.has(u.name)||f(u.name);return l}function Ho(e){let t=new Map(e.map(i=>[i.name,i])),n=new Map,s=[];function r(i){let a=[{name:i,exit:!1}];for(;a.length>0;){let{name:o,exit:l}=a.pop(),c=t.get(o);if(l){n.set(o,2),s.push(c);continue}if((n.get(o)??0)!==0)continue;if(n.set(o,1),c==null){n.set(o,2);continue}a.push({name:o,exit:!0});let f=[];for(let u of c.alts)u.length>0&&u[0].kind==="ref"&&t.has(u[0].name)&&f.push(u[0].name);for(let u=f.length-1;u>=0;u--)a.push({name:f[u],exit:!1})}}for(let i of e)r(i.name);return s}function Yo(e,t){for(let n of e.alts)if(n.length>0&&n[0].kind==="ref"&&n[0].name===t)return!0;return!1}var Es=512;fe.MAX_LEFT_RECURSION_EXPANSION=Es;var tn=131072;fe.MAX_LEFT_RECURSION_ELEMENTS=tn;function zo(e,t,n){let s=0;for(let i of e.alts)i.length>0&&i[0].kind==="ref"&&i[0].name===t.name&&s++;let r=s*Math.max(t.alts.length-1,0);if(r>Es-n)throw new ae(`${z()}: rule '${e.name}' exceeds the left-recursion expansion limit of ${Es} alternatives while inlining '${t.name}', which begins ${s} of its alternatives and has ${t.alts.length} of its own. Factor '${t.name}' out of the alternatives it begins.`,{rule:e.name,sp:e.sp});return n+r}function Gn(e,t){let n=[...e],s=0;for(;n.length>0;){let r=n.pop();if(s+=r.kind==="group"?1+r.alts.length:1,s>=t)return t;if(r.kind==="opt"||r.kind==="star"||r.kind==="plus"||r.kind==="rep")n.push(r.inner);else if(r.kind==="group")for(let i of r.alts)for(let a of i)n.push(a)}return s}function Vo(e,t,n){let s=tn-n,r=e.alts.filter(c=>c.length>0&&c[0].kind==="ref"&&c[0].name===t.name),i=()=>{throw new ae(`${z()}: rule '${e.name}' exceeds the left-recursion element limit of ${tn} elements while inlining '${t.name}', which begins ${r.length} of its alternatives and would add more than ${s} elements to the ${n} already added to the grammar. Factor '${t.name}' out of the alternatives it begins.`,{rule:e.name,sp:e.sp})},a=t.alts.length,o=Gn(t.alts.flat(),s+2);r.length>0&&o>s+1&&i();let l=0;for(let c of r){let f=a>1?Gn(c.slice(1),s-l+2):0;l+=Math.max(a*(1+f)+o-(2+f),0),l>s&&i()}return n+l}function Wo(e,t,n,s){let r=tn-s,i=Gn([t[0]],1/0),a=Gn([...n,...t.slice(1)],r+i+2),o=Math.max(a+1-i,0);if(o>r)throw new ae(`${z()}: rule '${e.name}' exceeds the left-recursion element limit of ${tn} elements while splitting the elements that can match nothing before '${e.name}' in one of its alternatives, which would add more than ${r} elements to the ${s} already added to the grammar. Write that alternative with fewer elements that can match nothing before '${e.name}'.`,{rule:e.name,sp:e.sp});return s+o}function Zo(e,t){let n=[];for(let s of e.alts)if(s.length>0&&s[0].kind==="ref"&&s[0].name===t.name){let r=s.slice(1);for(let i of t.alts)n.push([...i,...r])}else n.push(s);return{name:e.name,alts:n,nodeKind:e.nodeKind,origin:e.origin,sp:e.sp,value:e.value}}function Jo(e,t){let n=e.alts.map(s=>s.length>0&&s[0].kind==="ref"&&s[0].name===t?[{kind:"token",name:"#"+t},...s.slice(1)]:s);return{name:e.name,alts:n,nodeKind:e.nodeKind,origin:e.origin,sp:e.sp,value:e.value}}function Qo(e,t){let n="debt_"+e.replace(/[^A-Za-z0-9_]/gu,"_"),s=n,r=0;for(;t.has(s);)s=n+"_"+ ++r;return t.add(s),s}function el(e,t){let n=new Set;for(let s of e)nn(s,n);return n.has(t)}function tl(e,t=new Set){let n=[],s=[];for(let l of e.alts)l.length>0&&l[0].kind==="ref"&&l[0].name===e.name?n.push(l.slice(1)):s.push(l);let r=n.filter(l=>l.length>0);if(r.length===0)return{name:e.name,alts:s,nodeKind:e.nodeKind,origin:e.origin,sp:e.sp,value:e.value};if(s.length===0)throw new ae(`${z()}: rule '${e.name}' is purely left-recursive (no seed alternative); cannot eliminate`,{rule:e.name,sp:e.sp});let i=s.length===1&&s[0].length===1?s[0][0]:Uo({kind:"group",alts:s},s.find(l=>0<l.length)?.[0],e),a=r.length===1&&r[0].length===1?r[0][0]:qn({kind:"group",alts:r},r[0][0]),o={kind:"star",inner:a,debtGuard:void 0};return qn(o,a),el(s,e.name)&&(o.debtGuard=Qo(e.name,t)),{name:e.name,alts:[[i,o]],nodeKind:e.nodeKind,origin:e.origin,sp:e.sp,value:e.value}}function nl(e,t){let n=s=>s.kind==="term"||s.kind==="token"||s.kind==="regex";for(let s of e.productions){if(s.probeDispatch||s.probeHelper||s.name===t||s.alts.length!==1)continue;let r=s.alts[0];if(r.length<2)continue;let i=r[r.length-1];if(i.kind!=="opt")continue;let a;if(i.inner.kind==="group"){if(i.inner.alts.length!==1)continue;a=i.inner.alts[0]}else a=[i.inner];if(a.length<2)continue;let o=a[a.length-1];if(o.kind!=="ref"||o.name!==s.name)continue;let l=a.slice(0,-1);if(!l.every(n))continue;let c=r.slice(0,-1);c.length===0||!c.every(n)||(s.alts=[c],s.tailRepeat={sep:l})}return e}var Un=4;function It(e,t){if(e.kind!==t.kind)return!1;switch(e.kind){case"term":return Oe(e)===Oe(t);case"token":return e.name===t.name;case"ref":return e.name===t.name&&ti(e.debt)===ti(t.debt);case"regex":return e.pattern===t.pattern&&e.flags===t.flags;case"prose":return!1;case"star":return e.debtGuard===t.debtGuard&&It(e.inner,t.inner);case"opt":case"plus":return It(e.inner,t.inner);case"rep":return e.min===t.min&&e.max===t.max&&It(e.inner,t.inner);case"group":return e.alts.length===t.alts.length&&e.alts.every((n,s)=>ui(n,t.alts[s]))}}function ui(e,t){return e.length===t.length&&e.every((n,s)=>It(n,t[s]))}function ti(e){return e==null?"":Object.keys(e).sort().map(t=>t+"="+e[t]).join(",")}function hi(e,t){let n=new Set,s=[{kind:"seq",seq:e,at:0,total:0,room:Un}],r=(a,o)=>{for(;;)switch(a.kind){case"term":case"regex":case"token":return 1;case"prose":case"star":case"plus":return 1/0;case"opt":a=a.inner;continue;case"rep":if(a.max===1/0)return 1/0;if(a.max===0)return 0;s.push({kind:"rep",times:a.max}),o=Math.floor(o/a.max),a=a.inner;continue;case"group":s.push({kind:"alts",alts:a.alts,at:0,most:0,room:o,rule:null});return;case"ref":{let l=a.name;if(n.has(l))return 1/0;let c=t.productions.find(f=>f.name===l);if(!c||c.alts.length===0)return 1/0;n.add(l),s.push({kind:"alts",alts:c.alts,at:0,most:0,room:o,rule:l});return}}},i;for(;;){let a=s[s.length-1],o;if(a.kind==="seq")if(i!==void 0&&(a.total+=i,i=void 0),a.room<a.total)o=1/0;else if(a.at<a.seq.length){i=r(a.seq[a.at++],a.room-a.total);continue}else o=a.total;else if(a.kind==="alts"){if(i!==void 0&&(a.most<i&&(a.most=i),i=void 0),a.most!==1/0&&a.at<a.alts.length){s.push({kind:"seq",seq:a.alts[a.at++],at:0,total:0,room:a.room});continue}o=a.most}else o=a.times*i,i=void 0;if(s.pop(),a.kind==="alts"&&a.rule!=null&&n.delete(a.rule),s.length===0)return o;i=o}}function Ct(e,t,n){switch(e.kind){case"term":{if(e.literal.length===0)return null;let s=e.literal.codePointAt(0);if(!ln(e)){let r=String.fromCodePoint(s),i=r.toLowerCase().codePointAt(0),a=r.toUpperCase().codePointAt(0);return Ft(i===a?[[s,s]]:[[i,i],[a,a]],"")}return Ft([[s,s]],"")}case"regex":{let s=en(e.pattern,e.flags);return s==null?null:Ft(s,e.flags)}case"ref":{if(n.has(e.name))return null;let s=t.productions.find(a=>a.name===e.name);if(!s||s.alts.length===0)return null;let r=new Set(n);r.add(e.name);let i=[];for(let a of s.alts){if(a.length===0)return null;let o=Ct(a[0],t,r);if(o==null)return null;i.push(...o)}return i}case"group":{let s=[];for(let r of e.alts){if(r.length===0)return null;let i=Ct(r[0],t,n);if(i==null)return null;s.push(...i)}return s}case"plus":return Ct(e.inner,t,n);case"rep":return 0<e.min?Ct(e.inner,t,n):null;case"opt":case"star":case"token":case"prose":return null}}function di(e){let t=e;for(;t.length===1&&t[0].kind==="group"&&t[0].alts.length===1;)t=t[0].alts[0];return t}function sl(e){let t=new Set(e.productions.map(i=>i.name)),n=[],s=[...e.productions],r=i=>{let a=0,o;do o=`${i}$fact${a++}`;while(t.has(o));return t.add(o),o};for(;0<s.length;){let i=s.shift();if(i.probeDispatch||i.probeHelper||i.tailRepeat){n.push(i);continue}let a=i.alts;for(;;){let o=rl(i.name,ne(i),a,r,s,e);if(o==null)break;a=o}n.push(a===i.alts?i:{...i,alts:a})}return{productions:n}}function rl(e,t,n,s,r,i){let a=n.map(di),o=l=>Un<hi(l,i);for(let l=0;l<n.length-1;l++){if(a[l].length===0)continue;let c=a[l][0],f=[l],u=new Map([[l,a[l]]]),h=new Map,d;for(let S=l+1;S<n.length;S++){let O=a[S];if(0<O.length&&It(c,O[0])){f.push(S),u.set(S,O);continue}let $=0<O.length?il(O,c,i):null;if($!=null){f.push(S),u.set(S,$.seq),$.annotated!=null&&h.set(S,$.annotated);continue}if(d===void 0&&(d=Ct(c,i,new Set)),d==null||O.length===0)break;let ee=Ct(O[0],i,new Set);if(ee==null||kt(d,ee))break}if(f.length<2)continue;let p=f.map(S=>u.get(S)),b=1;e:for(;;){for(let S of p)if(S.length<=b||!It(p[0][b],S[b]))break e;b++}let m=p[0].slice(0,b);if(!o(m))continue;for(let S of f){let O=h.get(S);if(O==null)continue;let $=i.productions.find(ee=>ee.name===O);throw new ae(`${z()}: rule '${O}' builds a value, but it is the shared prefix of two alternatives of '${e}' that have to be left-factored \u2014 factoring inlines it, which would erase the value it is annotated to build. Give the alternatives leading tokens that tell them apart, or move the annotation to a rule that is not a shared prefix.`,{rule:O,sp:$?.sp})}let w=[];for(let S of p){let O=S.slice(b);w.some($=>ui($,O))||w.push(O)}w.sort((S,O)=>(S.length===0?1:0)-(O.length===0?1:0));let g;if(w.length===1)g=[...m,...w[0]];else{let S=s(e),O={name:S,alts:w,nodeKind:"helper",origin:t};w.some($=>$.length===0)&&(O.repeatHelper=!0),r.push(O),g=[...m,{kind:"ref",name:S}]}let _=f.every(S=>n[S].length===1&&n[S][0].kind==="group")?[{kind:"group",alts:[g]}]:g,v=new Set(f.slice(1)),x=[];for(let S=0;S<n.length;S++)v.has(S)||x.push(S===l?_:n[S]);return x}return null}function il(e,t,n){let s=e[0];if(s.kind!=="ref")return null;let r=n.productions.find(a=>a.name===s.name);if(!r||r.alts.length!==1||r.probeDispatch||r.probeHelper||r.tailRepeat)return null;let i=di(r.alts[0]);return i.length===0||!It(i[0],t)?null:{seq:[...i,...e.slice(1)],annotated:r.value!=null?r.name:null}}function al(e){let t=[],n=new Set(e.productions.map(c=>c.name)),s="";function r(c){let f=t.length,u;do f++,u=`_gen${f}_${c}`;while(n.has(u));return n.add(u),u}function i(c){return c.map(o)}function a(c,f,u){let h={name:c,alts:[[f,{kind:"ref",name:c}],[]],nodeKind:"helper",repeatHelper:!0,repeatLoop:!0,origin:s};return u&&(h.debtGuard=u),t.push(h),{kind:"ref",name:c}}function o(c){if(c.kind==="term"||c.kind==="ref"||c.kind==="regex"||c.kind==="token")return c;if(c.kind==="prose")throw new Error(`${z()}: internal: unresolved prose terminal '<${c.text}>'`);if(c.kind==="group"){let m=c.alts.map(g=>i(g)),w=r("group");return t.push({name:w,alts:m,nodeKind:"helper",origin:s}),{kind:"ref",name:w}}let f=o(c.inner),u=f.kind==="ref"?f.name:f.kind==="term"?f.tokenName??"term":f.kind==="token"?f.name.replace(/^#/,""):"x";if(c.kind==="opt"){let m=r("opt_"+u);return t.push({name:m,alts:[[f],[]],nodeKind:"helper",repeatHelper:!0,origin:s}),{kind:"ref",name:m}}if(c.kind==="star"){let m=r("star_"+u);return a(m,f,c.debtGuard)}if(c.kind==="plus"){let m=r("star_"+u),w=r("plus_"+u),g=a(m,f);return t.push({name:w,alts:[[f,g]],nodeKind:"helper",origin:s}),{kind:"ref",name:w}}let{min:h,max:d}=c,p=r("rep_"+u),b=[];for(let m=0;m<h;m++)b.push(f);if(d===1/0){let m=r("star_"+u);b.push(a(m,f))}else{let m=null;for(let w=0;w<d-h;w++){let g=m?[f,m]:[f],y=r("group");t.push({name:y,alts:[g],nodeKind:"helper",origin:s});let _={kind:"ref",name:y},v=r("opt_"+y);t.push({name:v,alts:[[_],[]],nodeKind:"helper",repeatHelper:!0,origin:s}),m={kind:"ref",name:v}}m&&b.push(m)}return t.push({name:p,alts:[i(b)],nodeKind:"helper",origin:s}),{kind:"ref",name:p}}return{productions:[...e.productions.map(c=>{s=ne(c);let f={name:c.name,alts:c.alts.map(i),nodeKind:c.nodeKind,origin:c.origin,sp:c.sp,value:c.value};return c.probeDispatch&&(f.probeDispatch=c.probeDispatch),c.probeHelper&&(f.probeHelper=c.probeHelper),c.tailRepeat&&(f.tailRepeat=c.tailRepeat),c.repeatHelper&&(f.repeatHelper=c.repeatHelper),c.repeatLoop&&(f.repeatLoop=c.repeatLoop),c.debtGuard&&(f.debtGuard=c.debtGuard),f}),...t]}}function nn(e,t){for(let n of e)if(n.kind==="ref")t.add(n.name);else if(n.kind==="opt"||n.kind==="star"||n.kind==="plus"||n.kind==="rep")nn([n.inner],t);else if(n.kind==="group")for(let s of n.alts)nn(s,t)}function ol(e){if(e.kind!=="opt")return null;let t=e.inner;if(t.kind!=="group"||t.alts.length!==1)return null;let n=t.alts[0];if(n.length<2)return null;let s=n[n.length-1];return s.kind!=="term"&&s.kind!=="regex"&&s.kind!=="token"?null:{xSeq:n.slice(0,-1),disambiguator:s}}function Fn(e,t,n,s){if(e.kind==="term"){let r=Oe(e);n.has(r)||n.set(r,e);return}if(e.kind==="regex"){let r=Fe(e);n.has(r)||n.set(r,e);return}if(e.kind==="token"){n.has(e.name)||n.set(e.name,e);return}if(e.kind==="ref"){if(s.has(e.name))return;s.add(e.name);let r=t.productions.find(i=>i.name===e.name);if(!r)return;for(let i of r.alts)for(let a of i)Fn(a,t,n,s);return}if(e.kind==="opt"||e.kind==="star"||e.kind==="plus"||e.kind==="rep"){Fn(e.inner,t,n,s);return}if(e.kind==="group"){for(let r of e.alts)for(let i of r)Fn(i,t,n,s);return}}function ni(e,t){let n=new Map,s=new Set;for(let r of e)Fn(r,t,n,s);return n}function ll(e,t){for(let n of e.keys())if(t.has(n))return!0;return!1}function cl(e,t){let n=e.ambiguities??[],s=[],r=new Set(e.productions.map(o=>o.name));function i(o){let l=o,c=1;for(;r.has(l);)l=o+c,c++;return r.add(l),l}let a=[];for(let o of e.productions){let l=[],c=!1;for(let f=0;f<o.alts.length;f++){let u=o.alts[f],h=[];for(let d=0;d<u.length;d++){let p=u[d],b=ol(p);if(!b){h.push(p);continue}let m=u.slice(d+1);if(m.length===0){h.push(p);continue}let w=ni(b.xSeq,e),g=ni(m,e);if(!ll(w,g)){h.push(p);continue}let y=b.disambiguator,_=y.kind==="term"?Oe(y):y.kind==="regex"?Fe(y):y.kind==="token"?y.name:null,v=w.size;for(let I of g.keys())w.has(I)||v++;_&&(w.has(_)||g.has(_))&&v--,t.begin(bt(ne(o)),ne(o),o.sp,qe.probe),t.charge(v+pi(v));let x=new Map([...w,...g]);_&&x.delete(_);let S=i(`${o.name}$pd${d}`),O=i(`${S}$probe`),$=i(`${S}$with`),ee=i(`${S}$no`);if(s.push({name:O,alts:[],probeHelper:{vocabElements:[...x.values()]},nodeKind:"helper",origin:ne(o)}),s.push({name:$,alts:[[...b.xSeq,b.disambiguator,...m]],nodeKind:"helper",origin:ne(o)}),s.push({name:ee,alts:[m],nodeKind:"helper",origin:ne(o)}),s.push({name:S,alts:[[{kind:"ref",name:$}],[{kind:"ref",name:ee}]],probeDispatch:{probeRule:O,disambiguator:b.disambiguator,withBranch:$,noBranch:ee},nodeKind:"helper",origin:ne(o)}),n.push({rule:o.name,altIdx:f,optIdx:d,reason:"optional prefix shares vocabulary with tail",resolved:!0}),o.value!=null)throw new ae(`${z()}: rule '${ne(o)}' has a value annotation, but its optional prefix shares vocabulary with what follows it, so the two are compiled into one dispatch helper \u2014 a member cannot cover the optional alone any more. Give the optional its own rule and annotate that, or make the prefix and the tail start with different tokens.`,{rule:ne(o),sp:o.sp});h.push({kind:"ref",name:S}),d=u.length,c=!0}l.push(h)}c?a.push({name:o.name,alts:l,nodeKind:o.nodeKind,origin:o.origin,sp:o.sp,value:o.value}):a.push(o)}return{productions:[...a,...s],ambiguities:n}}function fl(e,t,n,s,r,i){let a=e.probeHelper.vocabElements,o=[];for(let l of a){let c=l.kind==="term"?s.get(Oe(l)):l.kind==="regex"?r.get(Fe(l)):l.kind==="token"?l.name:void 0;c&&o.push({s:c,r:e.name,g:t})}o.push({g:t}),Ge(n,e.name,{open:o},i,pi(a.length))}function pi(e){return 3*e+2}function ul(e,t,n,s,r,i,a,o){let{probeRule:l,disambiguator:c,withBranch:f,noBranch:u}=e.probeDispatch,h=c.kind==="term"?r.get(Oe(c)):c.kind==="regex"?i.get(Fe(c)):c.kind==="token"?c.name:void 0;if(!h)throw new Error(`${z()}: probe-dispatch rule '${e.name}' has unresolvable disambiguator (kind=${c.kind})`);let d=s.bubble(m=>{m.child&&m.child.node!==void 0&&(m.node=m.child.node)});if(a){Ge(n,e.name,{open:[{c:"@probePhase0$",a:"@probeInit$",p:l,k:{pd_d:h},g:t},{c:"@probePhase1$",p:f,g:t},{c:"@probePhase2$",p:u,g:t}],close:[{c:"@probePhase0$",a:"@probeDecide$",r:e.name,g:t},{...d,g:t}]},o);return}let p=s.register((m,w)=>{m.k.pd_phase=0,m.k.pd_mark=w.mark()}),b=s.register((m,w)=>{let g=w.t[0];w.rewind(m.k.pd_mark);let y=g&&g.name===h;m.k.pd_phase=y?1:2});Ge(n,e.name,{open:[{c:s.register(m=>!m.k.pd_phase),a:p,p:l,g:t},{c:s.register(m=>m.k.pd_phase===1),p:f,g:t},{c:s.register(m=>m.k.pd_phase===2),p:u,g:t}],close:[{c:s.register(m=>m.k.pd_phase===0),a:b,r:e.name,g:t},{...d,g:t}]},o)}var sn=Object.assign(Object.create(null),{TX:"#TX",NR:"#NR",ST:"#ST",VL:"#VL"});fe.BUILTIN_TOKENS=sn;var mi="remove";fe.REMOVE_PROSE=mi;var gi="all";fe.REMOVE_ALL=gi;var Ln=e=>e.startsWith("<")&&e.endsWith(">");fe.isProseName=Ln;function hl(e){let t=s=>s.kind==="prose",n=[];for(let s of e.productions){let r=s.alts.length===1&&s.alts[0].length===1&&t(s.alts[0][0]);if(Ln(s.name)&&!r)throw new Error(`${z()}: '${s.name}' is prose, and prose is only valid as a production name for the removal directive '<all> = <remove>'.`);if(r){let a=s.alts[0][0].text;if(mi===a.trim().toLowerCase()){if(Ln(s.name)){let o=s.name.slice(1,-1).trim().toLowerCase();if(gi!==o)throw new Error(`${z()}: '<${o}>' is not a removal target. The only prose name is '<all>', as in '<all> = <remove>', which clears the whole grammar. To remove one rule or token, name it directly: '${o} = <remove>'.`);e.clearAll=!0}else(e.remove??=[]).push(s.name);continue}if(Ln(s.name))throw new Error(`${z()}: '${s.name}' is prose, and prose is only valid as a production name for the removal directive '<all> = <remove>'.`);if(sn[s.name])continue;throw new ae(`${z()}: rule '${s.name}' is defined only by prose ('<${a}>'), which describes a terminal but does not define one. Prose is allowed only for built-in lexer tokens (${Object.keys(sn).join(", ")}).`,{rule:s.name,sp:s.sp})}let i=a=>{if(t(a))return a;if(a.kind==="opt"||a.kind==="star"||a.kind==="plus"||a.kind==="rep")return i(a.inner);if(a.kind==="group")for(let o of a.alts)for(let l of o){let c=i(l);if(c)return c}};for(let a of s.alts)for(let o of a){let l=i(o);if(l)throw new ae(`${z()}: rule '${s.name}' uses prose ('<${l.text}>') inside an expression; prose may only stand alone as the whole definition of a built-in lexer token.`,{rule:s.name,sp:l.sp??s.sp})}n.push(s)}if(n.length===0&&!e.clearAll&&(e.remove===void 0||e.remove.length===0))throw new Error(`${z()}: grammar defines no rules \u2014 only informational prose terminals.`);e.productions=n}var dl=e=>{let t=Lo.util.isMatcherToken;if(typeof t!="function")throw new Error(`${z()}: this @tabnas/parser is too old \u2014 it does not export util.isMatcherToken, which the compiler needs to tell a fixed token from a matcher-owned one. Upgrade @tabnas/parser.`);return t("#"+e)};function pl(e,t){let n=new Map;for(let i of e.productions){if(i.name===t||dl(i.name)||i.nodeKind==="core"||i.value!=null||i.alts.length!==1||i.alts[0].length!==1)continue;let a=i.alts[0][0];a.kind==="term"&&a.literal!==""&&n.set(i.name,{literal:a.literal,caseSensitive:a.caseSensitive})}let s=new Map;for(let[i,a]of n){let o=Oe(a),l=s.get(o);l?l.push(i):s.set(o,[i])}for(let i of s.values())if(1<i.length)for(let a of i)n.delete(a);if(n.size===0)return[];let r=i=>{if(i.kind==="ref"){let a=n.get(i.name);return a?{kind:"term",...a,tokenName:i.name}:i}return i.kind==="opt"||i.kind==="star"||i.kind==="plus"||i.kind==="rep"?{...i,inner:r(i.inner)}:i.kind==="group"?{kind:"group",alts:i.alts.map(a=>a.map(r))}:i};return e.productions=e.productions.filter(i=>!n.has(i.name)).map(i=>({...i,alts:i.alts.map(a=>a.map(r))})),[...n].map(([i,a])=>({kind:"term",...a,tokenName:i}))}function ml(e){let t=new Set(e.productions.map(s=>s.name)),n=s=>{if(s.kind==="ref"){let r=sn[s.name];return r&&!t.has(s.name)?{kind:"token",name:r}:s}return s.kind==="opt"||s.kind==="star"||s.kind==="plus"||s.kind==="rep"?{...s,inner:n(s.inner)}:s.kind==="group"?{kind:"group",alts:s.alts.map(r=>r.map(n))}:s};for(let s of e.productions)s.alts=s.alts.map(r=>r.map(n))}function gl(e,t,n,s,r){let i=r&&/[A-Za-z0-9_]$/.test(e.literal)?"(?![A-Za-z0-9_])":"";if(ln(e)&&i===""){n[t]=e.literal;return}let a=ln(e)?"":"i",o=new RegExp("^"+Ai(e.literal)+i,a);o.eager$=!0,s[t]=o}var bi="bnf";function z(){return bi}var ae=class extends Error{constructor(t,n){super(t),this.name="EmitError",n?.rule!=null&&(this.rule=n.rule),n?.sp!=null&&(this.sp=n.sp)}};fe.EmitError=ae;function ki(e,t){return e+","+t}function bl(e){let t=!1,n=0;for(let s=0;s<e.length;s++){let r=e[s];if(r==="\\"){s++;continue}if(t){r==="]"&&(t=!1);continue}if(r==="["){t=!0;continue}if(r==="("){n++;continue}if(r===")"){n>0&&n--;continue}if(r==="|"&&n===0)return!0}return!1}function kl(e){return bl(e)?"(?:"+e+")":e}function wl(e){return{...e,productions:e.productions.map(t=>({...t,alts:t.alts.map(n=>n.slice())}))}}function wi(e,t){try{return new RegExp(e,t),Rs(e,t)===!0}catch{return!1}}function yi(e){let t=new Map,n=[],s=!1,r=!1;for(let i=0;i<e.length;i++){let a=e[i];if(a==="\\"){i++;continue}if(r){a==="]"&&(r=!1);continue}if(a==="["){r=!0;continue}if(a==="("){t.set(i,{end:-1,parent:n[n.length-1],alternates:!1,optional:!1,required:!1}),n.push(i);continue}if(a==="|"){let f=n[n.length-1];f==null?s=!0:t.get(f).alternates=!0;continue}if(a!==")")continue;let o=n.pop();if(o==null)return null;let l=t.get(o);l.end=i+1;let c=e[l.end];if(l.optional=c==="?"||c==="*",c==="{"){let f=l.end+1,u=f;for(;e[f]==="0";)f++;l.optional=u<f&&(e[f]===","||e[f]==="}")}}if(n.length!==0)return null;for(let i of t.values())if(i.parent==null)i.required=!s;else{let a=t.get(i.parent);i.required=a.required&&!a.optional&&!a.alternates}return{groups:t}}function yl(e){let t="",n=!1;for(let s=0;s<e.length;s++){let r=e[s];if(r==="\\"){let i=e[s+1];if(!n&&(/[1-9]/.test(i??"")||i==="k"&&e[s+2]==="<"))return null;t+=r,s+1<e.length&&(t+=e[++s]);continue}if(n){t+=r,r==="]"&&(n=!1);continue}if(r==="["){n=!0,t+=r;continue}if(r!=="("){t+=r;continue}if(e[s+1]!=="?"){t+="(?:";continue}if(e[s+2]==="<"&&e[s+3]!=="="&&e[s+3]!=="!"){let i=e.indexOf(">",s+3);if(i===-1)return null;t+="(?:",s=i;continue}t+=r}return t}function xi(e,t){let n=!1;for(let s=0;s<e.length;s++){let r=e[s];if(r==="\\"){let i=e[++s];if(!n&&(i==="b"||i==="B"))return!1;continue}if(n){r==="]"&&(n=!1);continue}if(r==="["){n=!0;continue}if(r==="^"||r==="$"||r==="("&&e[s+1]==="?"&&(e[s+2]==="="||e[s+2]==="!"||e[s+2]==="<"&&(e[s+3]==="="||e[s+3]==="!")))return!1}return Rs(e,t)===!1}function xl(e){if([...e].length===1&&!/[\\^$()[\]{}*+?|]/.test(e)||e===".")return!0;if(e[0]==="["){let t=!1;for(let n=1;n<e.length;n++){if(t){t=!1;continue}if(e[n]==="\\"){t=!0;continue}if(e[n]==="]")return n===e.length-1}return!1}return e[0]==="("?yi(e)?.groups.get(0)?.end===e.length:/^\\(?:[dDsSwWfnrtv.]|c[A-Za-z]|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|u\{[0-9A-Fa-f]+\}|[pP]\{[^}]+\})$/.test(e)}function vl(e,t,n){if(!e.startsWith("(?="))return!1;let s=n.groups.get(0);if(s==null||!s.required||s.optional)return!1;let r=e.slice(3,s.end-1);if(!xl(r)||!xi(r,t))return!1;let i=e.slice(s.end);for(let a of[r,"(?:"+r+")"]){if(!i.startsWith(a))continue;let o=i.slice(a.length);if(o==="?"||o==="*"||/^\{0,(?:[1-9]\d*|)\}$/.test(o))return!0}return!1}function Sl(e,t,n,s,r,i){let a=e[s+2]==="<",o=e[s+(a?3:2)]==="=",l=n.groups.get(s);if(l==null)return null;let c=l.required&&!l.optional,f=s+(a?4:3),u=r-1,h=!1,d=0,p=!1;for(let w=f;w<u;w++){let g=e[w];if(g==="\\"){w++;continue}if(p){g==="]"&&(p=!1);continue}if(g==="["){p=!0;continue}if(g==="("){d++;continue}if(g===")"){d--;continue}g==="|"&&d===0&&(h=!0)}let b=[];d=0,p=!1;let m=i;for(let w=f;w<u;w++){let g=e[w];if(g==="\\"){w++;continue}if(p){g==="]"&&(p=!1);continue}if(g==="["){p=!0;continue}if(g===")"){d--;continue}if(g!=="(")continue;let y=null,_;if(e[w+1]!=="?")y=w+1;else if(e[w+2]==="<"&&e[w+3]!=="="&&e[w+3]!=="!"){let v=e.indexOf(">",w+3);if(v===-1||u<=v)return null;_=e.slice(w+3,v),y=v+1}if(y!=null){m++;let v=n.groups.get(w),x=v?.end;if(x==null||r<x)return null;let S=v.optional,O=o&&c&&d===0&&!h&&!S,$=e.slice(y,x-1),ee=O&&xi($,t)?yl($):"";b.push({index:m,name:_,body:ee??""})}d++}return b}function _l(e,t){let n=0,s=0;for(let r=0;r<e.length;r++){let i=e[r];if(i==="\\"){r++;continue}if(0<s){t.includes("v")&&i==="["?s++:i==="]"&&s--;continue}if(i==="["){s=1;continue}i==="("&&(e[r+1]!=="?"||e[r+2]==="<"&&e[r+3]!=="="&&e[r+3]!=="!")&&n++}return n}function El(e,t,n){for(let s=t;s<n;s++){if(e[s]!=="\\")continue;if(e[s+1]!=="q"||e[s+2]!=="{"){s++;continue}let r=!1;for(s+=3;s<n;s++){let i=e[s];if(i==="\\")r=!0,s++;else if(i==="|"){if(!r)return!0;r=!1}else if(i==="}"){if(!r)return!0;break}else r=!0}}return!1}function Rs(e,t){let n={alternative:!1,sequence:!0,assertion:"none"},s=[],r=_l(e,t),i=(l,c)=>{let f=c,u=e[f];if(u==="?"||u==="*")l=!0,f++;else if(u==="+")f++;else if(u==="{"){let h=f+1,d=h,p=!0;for(;/[0-9]/.test(e[h]??"");)e[h]!=="0"&&(p=!1),h++;if(d<h){if(e[h]===",")for(h++;/[0-9]/.test(e[h]??"");)h++;e[h]==="}"&&(l=l||p,f=h+1)}}return e[f]==="?"&&f++,[l,f]},a=(l,c)=>{let f=i(l,c);return n.sequence=n.sequence&&f[0],f[1]},o=0;for(;o<e.length;){let l=e[o];if(l==="|"){n.alternative=n.alternative||n.sequence,n.sequence=!0,o++;continue}if(l===")"){if(s.length===0)return null;let c=n.alternative||n.sequence,f=n.assertion==="positive"?c:n.assertion==="negative"?!c:c;n=s.pop(),o=a(f,o+1);continue}if(l==="("){let c=o+1,f="none";if(e[o+1]==="?"){let u=e[o+2];if(u==="="||u==="!")f=u==="="?"positive":"negative",c=o+3;else if(u==="<"&&(e[o+3]==="="||e[o+3]==="!"))f=e[o+3]==="="?"positive":"negative",c=o+4;else if(u==="<"){let h=e.indexOf(">",o+3);if(h===-1)return null;c=h+1}else if(u===":")c=o+3;else{let h=o+2;for(;/[ims-]/.test(e[h]??"");)h++;if(e[h]!==":"||h===o+2)return null;c=h+1}}s.push(n),n={alternative:!1,sequence:!0,assertion:f},o=c;continue}if(l==="["){let c=1,f=o+1;for(;f<e.length&&0<c;){if(e[f]==="\\"){f+=2;continue}t.includes("v")&&e[f]==="["?c++:e[f]==="]"&&c--,f++}if(c!==0)return null;let u=t.includes("v")&&El(e,o+1,f-1);o=a(u,f);continue}if(l==="\\"){let c=e[o+1];if(c==null)return null;let f=o+2,u=c==="B";if(/[1-9]/.test(c)){for(;/[0-9]/.test(e[f]??"");)f++;u=Number(e.slice(o+1,f))<=r}else if(c==="k"&&e[o+2]==="<"){let h=e.indexOf(">",o+3);if(h===-1)return null;u=!0,f=h+1}else if((t.includes("u")||t.includes("v"))&&(c==="p"||c==="P"||c==="u")&&e[o+2]==="{"){let h=e.indexOf("}",o+3);if(h===-1)return null;f=h+1}else c==="c"&&f<e.length?f++:c==="x"?f=Math.min(e.length,f+2):c==="u"&&e[o+2]!=="{"&&(f=Math.min(e.length,f+4));o=a(u,f);continue}if(l==="^"||l==="$"){o=a(!0,o+1);continue}o=a(!1,o+1)}return s.length!==0?null:n.alternative||n.sequence}function Ol(e,t){try{new RegExp(e,t)}catch{return!1}if(wi(e,t))return!0;let n=yi(e);if(n==null)return!1;let s="",r=!1,i=0,a=new Map,o=new Map;for(let c=0;c<e.length;c++){let f=e[c];if(f==="\\"){let u=e[c+1];if(!r&&(u==="b"||u==="B"))s+="()",c++;else if(!r&&/[1-9]/.test(u??"")){let h=e.slice(c+1).match(/^[0-9]+/)?.[0]??u,d=a.get(Number(h));d!==void 0?(s+="(?:"+d+")",c+=h.length):(s+=f+u,c++)}else if(!r&&u==="k"&&e[c+2]==="<"){let h=e.indexOf(">",c+3),d=h===-1?"":e.slice(c+3,h),p=o.get(d);p!==void 0?(s+="(?:"+p+")",c=h):(s+=f,c+1<e.length&&(s+=e[++c]))}else s+=f,c+1<e.length&&(s+=e[++c]);continue}if(r){s+=f,f==="]"&&(r=!1);continue}if(f==="["){r=!0,s+=f;continue}if(f==="^"||f==="$"){s+="()";continue}if(f==="("&&e[c+1]==="?"&&(e[c+2]==="="||e[c+2]==="!"||e[c+2]==="<"&&(e[c+3]==="="||e[c+3]==="!"))){let u=n.groups.get(c)?.end;if(u==null)return!1;let h=Sl(e,t,n,c,u,i);if(h==null)return!0;s+=h.length===0?"()":"()".repeat(h.length);for(let d of h)a.set(d.index,d.body),d.name!=null&&o.set(d.name,d.body);i+=h.length,c=u-1;continue}f==="("&&(e[c+1]!=="?"||e[c+2]==="<"&&e[c+3]!=="="&&e[c+3]!=="!")&&i++,s+=f}let l=Rs(s,t);return l==null||l&&!vl(e,t,n)}function Dn(e,t){switch(e.kind){case"opt":case"star":return!0;case"plus":return Dn(e.inner,t);case"rep":return e.min===0||Dn(e.inner,t);case"group":return e.alts.some(n=>vi(n,t));case"ref":return t.has(e.name);case"term":return e.literal==="";case"regex":return wi(e.pattern,e.flags);case"token":return e.name==="#ZZ"||e.name==="#AA";default:return!1}}function et(e,t){switch(e.kind){case"opt":case"star":return!0;case"plus":return et(e.inner,t);case"rep":return e.min===0||et(e.inner,t);case"group":return e.alts.some(n=>n.every(s=>et(s,t)));case"ref":return t.has(e.name);case"term":return e.literal==="";case"regex":return Ol(e.pattern,e.flags);case"token":return e.name==="#ZZ"||e.name==="#AA";default:return!1}}function Al(e){let t=new Set,n=!0;for(;n;){n=!1;for(let s of e)t.has(s.name)||s.alts.some(r=>r.every(i=>et(i,t)))&&(t.add(s.name),n=!0)}return t}var vi=(e,t)=>e.every(n=>Dn(n,t));function Il(e){let t=new Set,n=!0;for(;n;){n=!1;for(let s of e)t.has(s.name)||s.alts.some(r=>vi(r,t))&&(t.add(s.name),n=!0)}return t}var Os=8192;fe.MAX_REPEAT_EXPANSION=Os;function jl(e){let t=0,n=(o,l,c)=>{let f=Go(o,l);throw new ae(`${z()}: rule '${f.rule}' ${c}`,{rule:f.rule,sp:f.sp})},s=(o,l)=>{if(o.kind==="group"){for(let c of o.alts)for(let f of c)s(f,l);return}if(o.kind==="rep"){let c=Number.isInteger(o.min)&&0<=o.min,f=o.max===1/0||Number.isInteger(o.max)&&0<=o.max;(!c||!f||o.max!==1/0&&o.max<o.min)&&n(o,l,`has invalid repetition bounds '${o.min}*${o.max}'. Bounds must be non-negative integers and the upper bound must not be lower than the lower bound.`)}(o.kind==="opt"||o.kind==="star"||o.kind==="plus"||o.kind==="rep")&&s(o.inner,l)};for(let o of e.productions)for(let l of o.alts)for(let c of l)s(c,o);let r=Al(e.productions),i=o=>{if(!et(o,r))return null;if(o.kind==="group"){let l=o.alts.find(c=>c.every(f=>et(f,r)));if(l==null)return null;for(let c of l){let f=i(c);if(f!=null)return f}return o}return o.kind==="plus"||o.kind==="rep"&&0<o.min?i(o.inner)??o:o},a=(o,l)=>{if(o.kind==="group"){for(let f of o.alts)for(let u of f)a(u,l);return}if(o.kind!=="opt"&&o.kind!=="star"&&o.kind!=="plus"&&o.kind!=="rep")return;if((o.kind==="star"||o.kind==="plus"||o.kind==="rep"&&o.max===1/0)&&et(o.inner,r)&&n(i(o.inner)??o,l,"has an unbounded repetition whose item can succeed without consuming input. An unbounded repetition must consume input on every iteration."),o.kind==="rep"){let f=Math.max(0,o.min),u=o.max===1/0?2+f:1+f+2*Math.max(0,o.max-o.min);if(!Number.isFinite(u)||u>Os-t){let h=o.max===1/0?"":String(o.max);n(o,l,`exceeds the repetition expansion limit of ${Os} while expanding '${o.min}*${h}'. Split the repetition into named rules or lower its bounds.`)}t+=u}a(o.inner,l)};for(let o of e.productions){for(let l of o.alts)for(let c of l)a(c,o);if(o.probeHelper!=null)for(let l of o.probeHelper.vocabElements)et(l,r)&&n(i(l)??l,o,"has a probe helper matcher that can succeed without consuming input. An unbounded repetition must consume input on every iteration.");if(o.tailRepeat!=null){let l=[...o.tailRepeat.sep,...o.alts[0]??[]];if(l.length>0&&l.every(c=>et(c,r))){let c=l[0];for(let f of l){let u=i(f);if(u!=null){c=u;break}}n(c,o,"has an unbounded tail repetition that can succeed without consuming input. An unbounded repetition must consume input on every iteration.")}}}}var Si=/[\s\u0085]/;function Nl(e){let t=new Set;for(let n of e.productions)n.probeHelper||n.probeDispatch||n.tailRepeat||n.value!=null||n.alts.length<2||n.name===""||Si.test(n.name)||Ts("#"+n.name)||n.alts.every(s=>s.length===1&&(s[0].kind==="term"||s[0].kind==="token")&&!Dn(s[0],new Set))&&t.add(n.name);if(0<t.size){let n=new Set;for(let s of e.productions)for(let r of s.alts)As(r,n);for(let s of[...t])n.has("#"+s)&&t.delete(s)}return t}function As(e,t){for(let n of e)if(n.kind==="token")t.add(n.name);else if(n.kind==="opt"||n.kind==="star"||n.kind==="plus"||n.kind==="rep")As([n.inner],t);else if(n.kind==="group")for(let s of n.alts)As(s,t)}var Jt=35e5;fe.MAX_EMIT_UNITS=Jt;var qe={probe:{doing:"writing the probe for one of its optional prefixes",advice:"Write that optional prefix and what follows it as two alternatives, one with the prefix and one without."},tokenSet:{doing:"listing the members of its token set",advice:"Write fewer character classes that overlap it."},tokenClass:{doing:"listing the members of its token class",advice:"Give it fewer alternatives."},first:{doing:"collecting the tokens it can begin with",advice:"Reduce the tokens it can begin with."},follow:{doing:"collecting the tokens that can follow it",advice:"Reduce the tokens that can follow it."},pairs:{doing:"collecting the pairs of tokens that can follow it",advice:"Reduce the tokens that can follow it."},alternates:{doing:"writing its alternates",advice:"Factor what its alternatives share into rules of their own."},lookahead:{doing:"enumerating the token sequences that tell its alternatives apart",advice:"Give its alternatives first tokens that tell them apart, or factor what they begin with into a rule of its own."},remove:{doing:"writing the rules and tokens it removes",advice:"Remove fewer names."}},Is=class{constructor(){this.written=0,this.held=0,this.subject="",this.step=qe.alternates,this.start=0}begin(t,n,s,r){this.subject=t,this.rule=n,this.sp=s,this.step=r,this.start=this.written}charge(t){t>Jt-this.written-this.held&&this.refuse(!1),this.written+=t}hold(t){t>Jt-this.written-this.held&&this.refuse(!0),this.held+=t}settle(t,n){let s=0;for(let r of n)s+=1+r.tokens.length;this.held=t+s}keep(t,n){this.held=t+n}restore(t){this.held=t}refuse(t){let n=t?qe.lookahead:this.step,s=Jt-this.start;throw new ae(`${z()}: ${this.subject} exceeds the emit limit of ${Jt} units while ${n.doing}, which would `+(t?`hold more than ${s} units on top of the ${this.start} already `:`add more than ${s} units to the ${this.start} already `)+`written. ${n.advice}`,{rule:this.rule,sp:this.sp})}};function bt(e){return`rule '${e}'`}function js(e){let t=1,n=e.s;if(typeof n=="string"&&0<n.length){t++;for(let s=0;s<n.length;s++)n.charCodeAt(s)===32&&t++}return e.p!=null&&t++,e.r!=null&&t++,t}function $l(e){let t=1;for(let n of e.open??[])t+=js(n);for(let n of e.close??[])t+=js(n);return t}function Tl(e,t){let n=js(t);return e.charge(n),n}function Ge(e,t,n,s,r=0){let i=$l(n);if(i<r)throw new Error(`${z()}: internal \u2014 rule '${t}' holds ${i} units, fewer than the ${r} charged for its alternates`);s.charge(i-r),e[t]=n}var Rl=65536,rn=Rl;function Ml(e){let t=rn;return rn=e,t}function Cl(e,t){e=wl(e);let n=t?.tag??"bnf";bi=n;let s=new Is,{plan:r,collect:i}=Bo(e);hl(e);let a=e.remove?[...e.remove]:[],o=!!e.clearAll,l=t?.start??e.productions[0].name,c=!!t?.wordKeywords,f=Il(e.productions).has(l),u=pl(e,l);ml(e);let d=!!t?.tokenClasses?Nl(e):new Set;e=ci(e,d),e=cl(e,s),e=sl(e),e=nl(e,l),jl(e),e=al(e);let p=qo(e,i),b=new Set(e.productions.filter(k=>k.value!=null).map(k=>k.name)),m=new Map,w=new Map,g=new Set,y=new Map;for(let k of e.productions)d.has(k.name)&&y.set(k.name,Xn(k.name,g,k.name));let _=Object.create(null),v=Object.create(null),x=Object.create(null),S=new Map,O=[...u];for(let k of e.productions){for(let E of k.alts)O.push(...E);k.probeHelper&&O.push(...k.probeHelper.vocabElements),k.tailRepeat&&O.push(...k.tailRepeat.sep)}let $=Wl(O),ee=O.filter(k=>k.kind==="term"&&k.tokenName);for(let k of[...ee,...O])if(k.kind==="term"){let E=Oe(k);if(!m.has(E)){let A=Xn(k.literal,g,k.tokenName);m.set(E,A),gl(k,A,_,v,c)}}else if(k.kind==="regex"){let E=Fe(k);w.has(E)||Zl(k,E,$,w,x,S,v,g,s)}let I=new Set(e.productions.map(k=>k.name)),q=new Map,j=k=>{if(q.has(k))return q.get(k);let E=S.get(k);if(E!=null)return q.set(k,Kn(E)),q.get(k);let A=null,M=_[k];if(typeof M=="string"&&0<M.length){let T=M.codePointAt(0);A=Ft([[T,T]],"")}else{let T=v[k];if(T!=null){let L=T.source.replace(/^\^/,""),R=/^\(\?:(.*)\)$/.exec(L);R&&(L=R[1]),A=en(L,T.flags),A!=null&&T.flags.includes("i")&&(A=Vl(A)),A!=null&&(A=Ft(A,T.flags))}}return q.set(k,A==null?null:Kn(A)),q.get(k)},C=new Map;for(let k of e.productions){let E=y.get(k.name);if(E==null)continue;let A=[];s.begin(bt(ne(k)),ne(k),k.sp,qe.tokenClass);for(let T of k.alts){let L=T[0],R=L.kind==="term"?m.get(Oe(L)):L.name;A.includes(R)||(s.charge(1),A.push(R))}x[E.replace(/^#/,"")]=A,C.set(E,A);let M=[];for(let T of A){let L=j(T);if(L==null){M=null;break}M.push(...L)}M!=null&&S.set(E,M)}let V=new Map,H=(k,E)=>{let A=k<E?k+"\0"+E:E+"\0"+k,M=V.get(A);if(M!==void 0)return M;let T=!1,L=C.get(k),R=C.get(E),oe=V.size<rn;if(L!=null||R!=null){V.set(A,!0);for(let N of L??[k]){for(let J of R??[E])if(N===J||H(N,J)){T=!0;break}if(T)break}}else{let N=j(k),J=j(E);T=N!=null&&J!=null&&kt(N,J)}return oe?V.set(A,T):V.delete(A),T},{firstSets:K,nullable:re}=Ul(e,m,w,y,s),Z=Xl(e,m,w,K,re,l,s),he=Hl(e,m,w,K,re,Z,s),ve=new Map;for(let[k,E]of m)ve.set(E,{literal:k.slice(3),sensitive:k.startsWith("cs:")});let Ie=k=>c&&/[A-Za-z0-9_]$/.test(k),F=(k,E)=>E.toLowerCase().startsWith(k.toLowerCase())||E.toUpperCase().startsWith(k.toUpperCase()),Y=k=>{let E=v[k];if(E==null)return!0;if(E.flags.includes("i")){let R=j(k);if(R==null||R.some(([,oe])=>127<oe))return!1}if(ve.has(k))return!0;let A=E.source.replace(/^\^/,""),M=/^\(\?:(.*)\)$/.exec(A);M&&(A=M[1]);let T=Yl(A,E.flags);if(T<0||!/[uv]/.test(E.flags)&&A.slice(0,T).includes("\\u{"))return!1;let L=A.slice(T);return(L===""||L==="+")&&j(k)!=null},Me=[[43,43],[45,46],[48,57]],Ue=[[34,34],[39,39],[96,96]],de=(k,E)=>{if(k==="#TX")return E==="#NR"||E==="#ST"||v[E]!=null;let A=k==="#NR"?Me:k==="#ST"?Ue:null;if(A==null)return!1;let M=j(E);return M!=null&&kt(A,M)},me=new Map,le=(k,E)=>{if(k===E||k==="#AA"||E==="#AA")return!0;let A=k<E?k+"\0"+E:E+"\0"+k,M=me.get(A);if(M!==void 0)return M;let T=me.size<rn,L=!1,R=x[k.replace(/^#/,"")],oe=x[E.replace(/^#/,"")],N=ve.get(k),J=ve.get(E);if(R!=null||oe!=null){me.set(A,!0);let se=R??[k],B=oe??[E];for(let Q of se){for(let ie of B)if(le(Q,ie)){L=!0;break}if(L)break}}else if(N!=null&&J!=null){let se=N.literal,B=J.literal,[Q,ie]=se.length<=B.length?[se,B]:[B,se];(!(N.sensitive&&J.sensitive)?F(Q,ie):ie.startsWith(Q))&&(L=!(Ie(se)&&Ie(B)&&Q.length<ie.length&&/[A-Za-z0-9_]/.test(ie[Q.length])))}else L=!Y(k)||!Y(E)||H(k,E)||de(k,E)||de(E,k);return T?me.set(A,L):me.delete(A),L};Dl(e,m,w,K,re,H);let ke=new Ns;ke.useBuiltins=!!t?.builtins,ke.emitMarks=!!t?.marks;let Ae=t?.provenance===!1?void 0:new Map,Ke=Object.create(null),Nt={literal:new Set([...m.values(),...y.values()]),charClass:new Set(w.values())};for(let k of e.productions){if(Ae!=null&&ne(k)!==k.name&&Ae.set(k.name,ne(k)),s.begin(bt(ne(k)),ne(k),k.sp,qe.alternates),k.probeHelper){fl(k,n,Ke,m,w,s);continue}if(k.probeDispatch){ul(k,n,Ke,ke,m,w,!!t?.builtins,s);continue}Bl(k,e,m,w,I,n,Ke,K,re,ke,Z,he,j,H,le,y,C,Nt,r,p,b,s,Ae)}let st="__start__";if(I.has(st)){let k=2;for(;I.has(`__start${k}__`);)k++;st=`__start${k}__`}Ae?.set(st,l),s.begin(bt(l),l,void 0,qe.alternates),Ge(Ke,st,{open:[{p:l,g:n}],close:[{s:"#ZZ",...ke.bubble(k=>{k.child&&k.child.node!==void 0&&(k.node=k.child.node)}),g:ki(n,"end")}]},s);let xt={fixed:{token:_},rule:{start:st},lex:{empty:f}};Object.keys(v).length>0&&(xt.match={token:v}),Object.keys(x).length>0&&(xt.tokenSet=x);let rt={ref:ke.map,options:xt,rule:Ke};if(Ae!=null&&0<Ae.size){let k=Object.create(null);for(let E of[...Ae.keys()].sort())k[E]=Ae.get(E);rt.meta={provenance:k}}if(o&&(rt.clear=!0),0<a.length){let k=a.length;s.begin(`the removal list of ${k} name${k===1?"":"s"}`,void 0,void 0,qe.remove);for(let E of a)s.charge(1),rt.rule[E]=null,s.charge(1),xt.fixed.token["#"+E]=null}return rt}function an(e,t,n){let s=[],r={terms:[],ref:null};for(let i of e)if(i.kind==="term")r.terms.push(t.get(Oe(i)));else if(i.kind==="regex"){let a=Fe(i);r.terms.push(n.get(a))}else if(i.kind==="token")r.terms.push(i.name);else if(i.kind==="ref")r.ref=i.name,i.debt&&(r.debt=i.debt),s.push(r),r={terms:[],ref:null};else throw new Error(`${z()}: internal \u2014 unexpected element kind '${i.kind}' in emitter`);return(r.terms.length>0||s.length===0)&&s.push(r),s}function Fe(e){return`/${e.pattern}/${e.flags}`}function Pl(e){let t=!1;for(let n of e)if(n.kind==="ref"){if(t)return!1;t=!0}else if(n.kind==="term"||n.kind==="regex"||n.kind==="token"){if(t)return!1}else return!1;return!0}function Fl(e,t,n){for(let s of e)if(s.kind==="ref"&&!t.has(s.name))throw new ae(`${z()}: rule '${n}' references unknown rule '${s.name}'`,{rule:n,sp:s.sp})}var Ns=class{constructor(){this.refs=Object.create(null),this.counter=0,this.useBuiltins=!1,this.emitMarks=!1}register(t){let n=`@bnf_a${this.counter++}`;return this.refs[n]=t,n}get map(){return this.refs}node(t,n){return this.useBuiltins?{a:"@node$",k:{node$:t}}:{a:this.register(n)}}capture(t,n){return this.useBuiltins?{a:"@capture$",k:{capture$:t}}:{a:this.register(n)}}bubble(t){return this.useBuiltins?{a:"@bubble$"}:{a:this.register(t)}}fold(t,n){return this.useBuiltins?{a:"@fold$",k:{fold$:t}}:{a:this.register(n)}}};function _i(e,t){let n=t.length;for(let s=0;s<n;s++)e.push(t[s])}function si(e){return t=>{let n=t.parent&&t.parent.node;if(n==null||typeof n!="object"||!("src"in n))return;let s=t.node;s!=null&&typeof s=="object"&&"src"in s&&s!==n&&(n.src+=s.src,s.rule?n.kids.push(s):Array.isArray(s.kids)&&_i(n.kids,s.kids));for(let r=0;r<e;r++)n.src+=t.c[r].src;t.node=void 0}}function Pt(e,t){return t==="user"?{rule:e,src:"",kids:[]}:{src:"",kids:[]}}function Ei(e,t,n){if(e.length===0)return"_";let s=e[0];return s.kind==="term"?(t.get(Oe(s))||"").replace(/^#/,"")||"_":s.kind==="regex"?(n.get(Fe(s))||"").replace(/^#/,"")||"_":s.kind==="token"?s.name.replace(/^#/,"")||"_":s.kind==="ref"?s.name:"_"}function $s(e,t,n){let s=new Map,r=new Map;for(let i of e){let a=Ei(i,t,n),o=(r.get(a)||0)+1;r.set(a,o),s.set(i,o===1?a:`${a}~${o}`)}return s}function Qt(e,t,n,s,r,i){let a={g:t};e.terms.length>0&&(a.s=e.terms.join(" ")),e.ref&&(a.p=e.ref),e.debt&&(a.n={...e.debt});let o=e.terms.length;return(o>0||s)&&Object.assign(a,n.node({init:s,rule:r,kind:i,nterms:o},l=>{s&&(l.node=Pt(r,i));let c=l.node;for(let f=0;f<o;f++)c.src+=l.o[f].src})),a}function on(e,t,n){return e.capture({rule:t,kind:n},s=>{s.node==null&&(s.node=Pt(t,n));let r=s.node,i=s.child&&s.child.node;if(i!=null){if(typeof i!="object"||!("src"in i)){r.kids.push(i);return}i!==r&&(r.src+=i.src,i.rule?r.kids.push(i):Array.isArray(i.kids)&&_i(r.kids,i.kids))}})}function Ll(e,t,n,s,r,i,a){let o=e.nodeKind??"user",l=e.alts[0],c=e.tailRepeat.sep,f=an(l,t,n)[0],u=an(c,t,n)[0],h=o==="user"&&i.emitMarks?$s([l,c],t,n):null,d=Qt(f,s,i,!0,e.name,o);h&&(d.m=h.get(l));let p={s:u.terms.join(" "),r:e.name,...i.fold({cN:u.terms.length},si(u.terms.length)),g:ki(s,"comma")};h&&(p.m=h.get(c));let b={...i.fold({},si(0)),g:s};h&&(b.m="_"),Ge(r,e.name,{open:[d],close:[p,b]},a)}function Bl(e,t,n,s,r,i,a,o,l,c,f,u,h,d,p,b,m,w,g,y,_,v,x){let S=y.has(e.name),O=0,$=k=>(O+=Tl(v,k),k);for(let k of e.alts)Fl(k,r,e.name);let ee=k=>{if(!e.repeatHelper)return[];let E=u.get(e.name);if(E==null||E.size===0)return[];let A=o.get(e.name)??new Set,M=[],T=new Set;for(let[L,R]of E){if(R.size===0||h(L)==null)continue;let oe=!1;for(let N of A)if(N!==L&&d(L,N)){oe=!0;break}if(oe)for(let N of R){let J=L+" "+N;T.has(J)||(T.add(J),M.push($({...k,s:J,b:2})))}}return M},I=(k,E,A,M)=>{let T=v.held,L=Hn(E,t,n,s,2,new Set,void 0,b,v),R=new Set,oe=!0;for(let N of L){if(N.tokens[0]!==A)continue;if(2<=N.tokens.length){R.add(N.tokens[1]);continue}let J=f.get(e.name);if(J==null||J.size===0){oe=!1;break}for(let se of J)R.add(se)}return v.restore(T),!oe||R.size===0||16<R.size?null:[...R].map(N=>$({...k,s:A+" "+N,b:2-M}))},q=k=>{let E=m.get(k);if(E==null)return h(k);let A=null;for(let M of E){let T=h(M);if(T!=null){A==null&&(A=[]);for(let L of T)A.push(L)}}return A},j=k=>k.p??k.r,C=w.literal,V=w.charClass,H=k=>{let E=k.length,A=new Array(E),M=new Array(E);for(let B=0;B<E;B++){let Q=k[B].o.s;if(typeof Q!="string"||Q.length===0){A[B]=null,M[B]=0;continue}let ie=Q.indexOf(" ");A[B]=ie===-1?Q:Q.substring(0,ie);let Se=1;for(let Ee=0;Ee<Q.length;Ee++)Q.charCodeAt(Ee)===32&&Se++;M[B]=Se}let T=[],L=[];for(let B=0;B<E;B++){let Q=A[B];if(Q==null||!V.has(Q))continue;let ie=h(Q);ie!=null&&(T.push(B),L.push(ie))}if(T.length===0)return k.map(B=>B.o);let R=[],oe=0,N=(B,Q)=>R.push({o:B,rank:Q,seq:oe++}),J=new Map,se=0;for(let B=0;B<E;B++){let{o:Q,alt:ie}=k[B],Se=A[B],Ee=Se!=null&&C.has(Se)?q(Se):null,$t=-1,Lt=-1;if(Ee!=null&&ie!=null){let it=J.get(Se);if(it===void 0&&se+T.length<=rn){it=new Uint8Array(T.length);for(let Xe=0;Xe<T.length;Xe++)it[Xe]=kt(Ee,L[Xe])?1:0;J.set(Se,it),se+=T.length}for(let Xe=0;Xe<T.length;Xe++){if(it!==void 0?it[Xe]===0:!kt(Ee,L[Xe]))continue;let Jn=T[Xe];j(Q)!=null&&j(k[Jn].o)===j(Q)||($t===-1&&($t=Jn),Lt=Jn)}}if($t===-1){N(Q,B);continue}let Ce=$t-.5,We=Lt+.5;if(2<=M[B]){N(Q,Math.min(B,Ce));continue}let Zn=1-(Q.b??0),Ks=Zn===0||Zn===1?I(Q,ie,Se,Zn):null;if(Ks==null){N(Q,B);continue}for(let it of Ks)N(it,Math.min(B,Ce));N(Q,Math.max(B,We))}return R.sort((B,Q)=>B.rank-Q.rank||B.seq-Q.seq).map(B=>B.o)},K=k=>{let E=k.length,A=new Array(E),M=new Array(E);for(let N=0;N<E;N++){let{o:J,alt:se}=k[N],B=J.s;if(typeof B!="string"||B.length===0){M[N]=null,A[N]=0;continue}let Q=1;for(let Ee=0;Ee<B.length;Ee++)B.charCodeAt(Ee)===32&&Q++;if(A[N]=Q,se==null){M[N]=null;continue}let ie=B.indexOf(" "),Se=ie===-1?B:B.substring(0,ie);M[N]=V.has(Se)?Se:null}let T=new Array(E);for(let N=0;N<E;N++)T[N]=M[N]==null?null:h(M[N]);let L=[];for(let N=0;N<E;N++){let J=T[N];if(J!=null)for(let se=0;se<E;se++){if(se===N||T[se]==null)continue;let B=j(k[N].o);if(!(B!=null&&j(k[se].o)===B)&&kt(J,T[se])){L.push(N);break}}}if(L.length<2)return;let R=new Map;for(let N of L){let J=k[N].alt,se=J==null?0:hi(J,t);R.set(N,Number.isFinite(se)?se:1e9)}let oe=L.slice().sort((N,J)=>A[J]-A[N]||R.get(J)-R.get(N)).map(N=>k[N]);L.forEach((N,J)=>{k[N]=oe[J]})},re=k=>{if(!e.repeatHelper)return!1;let E=mt(k,n,s,o,l);if(E==null)return!1;let A=f.get(e.name)??new Set;for(let M of E)for(let T of A)if(T===M||d(M,T))return!0;return!1},Z=(k,E)=>{let A=mt(k,n,s,o,l);if(A==null)return!1;for(let M of E){if(M===k||M.length===0)continue;let T=mt(M,n,s,o,l);if(T!=null){for(let L of A)for(let R of T)if(d(L,R))return!0}}return!1},he=w.charClass,ve=(k,E)=>{let A=mt(k,n,s,o,l);if(A==null)return!1;for(let M of E){if(M===k||M.length===0)continue;let T=mt(M,n,s,o,l);if(T!=null){for(let L of A)for(let R of T)if(L===R||he.has(L)&&he.has(R)&&d(L,R))return!0}}return!1},Ie=k=>{if(e.debtGuard==null||e.debtOwed==null)return;let E=new Set(e.debtOwed),A={["n."+e.debtGuard]:0};for(let M of k){if(M.alt==null||M.alt.length===0)continue;let T=M.o.s,L=typeof T=="string"?T.split(" ")[0]:null;L!=null&&!E.has(L)||(M.o.c=A)}};if(e.tailRepeat){Ll(e,n,s,i,a,c,v);return}let F=e.repeatLoop?Gl(e):null,Y=()=>{let k=e.nodeKind??"helper",E={c:{["n."+Bn]:0},n:{[Bn]:1},r:e.name,...c.node({init:!0,rule:e.name,kind:k,nterms:0},A=>{A.node=Pt(e.name,k)}),g:i};return S&&ze(E,[]),E},Me=e.alts.every(Pl),Ue=S&&1<e.alts.length&&!e.repeatHelper;if(Me&&e.value==null&&!Ue){let k=[...e.alts.filter(R=>R.length>0),...e.alts.filter(R=>R.length===0)],E=e.nodeKind??"user",A=E==="user"&&c.emitMarks?$s(k,n,s):null,M=k.length>1,T=[];for(let R of k){let N=an(R,n,s)[0],J=R.length>=1&&R.every(ie=>ie.kind==="ref")&&N.terms.length===0&&N.ref!=null,se=A?A.get(R):void 0;if(M&&J){let ie=mt(R,n,s,o,l);if(ie){let Se=c.node({init:!0,rule:e.name,kind:E,nterms:0},Ce=>{Ce.node=Pt(e.name,E)}),Ee=null,$t=v.held;if(Z(R,k)||re(R)){let Ce=sc(R,t,n,s,Un,b,v).filter(We=>0<We.length);0<Ce.length&&Ce.length<=64&&(Ee=Ce)}let Lt=N.debt?{n:{...N.debt}}:null;if(Ee)for(let Ce of Ee){let We={s:Ce.join(" "),b:Ce.length,p:N.ref,...Lt,...Se,g:i};se&&(We.m=se),T.push({o:$(We),alt:R})}else for(let Ce of ie){let We={s:Ce,b:1,p:N.ref,...Lt,...Se,g:i};se&&(We.m=se),T.push({o:$(We),alt:R})}v.restore($t);continue}}let B;if(F==null)B=Qt(N,i,c,!0,e.name,E);else if(0<R.length){let{g:ie,s:Se,...Ee}=Qt({terms:N.terms,ref:null},i,c,!1,e.name,E);B={g:ie,s:Se,r:e.name,...Ee}}else B=Qt(N,i,c,!1,e.name,E);if(se&&(B.m=se),R.length===0&&e.repeatHelper){for(let ie of f.get(e.name)??[])T.push({o:$({...B,s:ie,b:1}),alt:null});T.unshift(...ee(B).map(ie=>({o:ie,alt:null})))}let Q=!M||N.ref==null||N.terms.length===0||l.has(N.ref)||!ve(R,k)?null:[...o.get(N.ref)??[]];if(Q!=null&&0<Q.length&&Q.length<=64){for(let ie of Q)T.push({o:$({...B,s:[...N.terms,ie].join(" "),b:1}),alt:R});continue}T.push({o:$(B),alt:0<R.length?R:null})}if(Ie(T),K(T),S)for(let R of T)ze(R.o,[]);let L={open:H(T)};if(F!=null){L.open.unshift(Y()),Ge(a,e.name,L,v,O);return}if(e.alts.some(R=>R.some(oe=>oe.kind==="ref"))){let R={...on(c,e.name,e.nodeKind??"user"),g:i};A&&(R.m="_"),L.close=[R]}if(S){let R=k.map(oe=>an(oe,n,s)[0]?.ref).find(oe=>oe!=null&&!y.has(oe));for(let oe of L.close??[])Ms(oe,R,_)}Ge(a,e.name,L,v,O);return}if(e.alts.length===1){ri(e.name,e.alts[0],n,s,i,a,c,v,e.nodeKind??"user",x,ne(e),e.value,g.get(ne(e)),e.sp,y,_,S);return}if(e.value!=null)throw new Error(`${z()}: rule '${ne(e)}' has a value annotation and ${e.alts.length} alternatives. A value annotation names the parts of ONE alternative; with more than one it is ambiguous which alternative's parts are named. Split the rule, or annotate the alternatives' own rules.`);let de=[],me=!1,le=[],ke=(e.nodeKind??"user")==="user"&&c.emitMarks?$s(e.alts,n,s):null,Ae=[];if(e.alts.some(k=>k.length===0)||e.alts.some(k=>0<k.length&&mt(k,n,s,o,l)==null)){for(let E of f.get(e.name)??[])Ae.push([E]);let k=u.get(e.name);if(k!=null)for(let[E,A]of k)for(let M of A)Ae.push([E,M])}let Nt=v.held,st=rc(e.alts,t,n,s,Un,p,Ae,b,v);for(let k=0;k<e.alts.length;k++){let E=e.alts[k],A=`${e.name}$alt${k}`,M=ke?ke.get(E):void 0;if(E.length===0){me=!0;continue}x?.set(A,ne(e)),F!=null?ql(e,A,F,i,a,c,x,S,y,_,v):ri(A,E,n,s,i,a,c,v,"helper",x,ne(e),void 0,void 0,void 0,y,_,S);let T=e.nodeKind??"user",L=F==null?"p":"r",R=F!=null?{}:c.node({init:!0,rule:e.name,kind:T,nterms:0},N=>{N.node=Pt(e.name,T)});st[k].nullable&&F==null&&le.push({implName:A,fields:R,mark:M});let oe=st[k].prefixes;if(oe.length>0)for(let N of oe){let J={s:N.join(" "),b:N.length,[L]:A,...R,g:i};M&&(J.m=M),de.push({o:$(J),alt:E})}else{let N=mt(E,n,s,o,l);if(N===null)throw new ae(`${z()}: rule '${e.name}' alternative ${k} is nullable but is not the only empty alt; FIRST set is ambiguous`,{rule:e.name,sp:e.sp});for(let J of N){let se={s:J,b:1,[L]:A,...R,g:i};M&&(se.m=M),de.push({o:$(se),alt:E})}}}v.restore(Nt);for(let k of le){for(let A of f.get(e.name)??[]){let M={s:A,b:1,p:k.implName,...k.fields,g:i};k.mark&&(M.m=k.mark),de.push({o:$(M),alt:null})}let E={p:k.implName,...k.fields,g:i};k.mark&&(E.m=k.mark),de.push({o:$(E),alt:null})}if(me){let k=e.nodeKind??"user",E=F!=null?{g:i}:{...c.node({init:!0,rule:e.name,kind:k,nterms:0},A=>{A.node=Pt(e.name,k)}),g:i};if(ke&&(E.m="_"),e.repeatHelper){for(let A of f.get(e.name)??[])de.push({o:$({...E,s:A,b:1}),alt:null});de.unshift(...ee(E).map(A=>({o:A,alt:null})))}de.push({o:$(E),alt:null})}if(S)for(let k of de)ze(k.o,[]);Ie(de),K(de);let xt=H(de);if(F!=null){Ge(a,e.name,{open:[Y(),...xt]},v,O);return}let rt={...on(c,e.name,e.nodeKind??"user"),g:i};ke&&(rt.m="_"),S&&ze(rt,[]),Ge(a,e.name,{open:xt,close:[rt]},v,O)}function ql(e,t,n,s,r,i,a,o,l,c,f){if(n.kind!=="ref")throw new Error(`${z()}: internal \u2014 repeat loop '${e.name}' dispatches a terminal item through an iteration rule`);let u=t+"$step1";a?.set(u,ne(e));let h={p:n.name,n:{[Bn]:0},g:s},d={r:u,n:{[Bn]:1},...on(i,t,"helper"),g:s};o&&Ms(d,l.has(n.name)?null:n.name,c),Ge(r,t,{open:[h],close:[d]},f),Ge(r,u,{open:[{r:e.name,g:s}]},f)}function Gl(e){let t=e.alts,n=t.find(r=>0<r.length),s=n?.[1];if(t.length!==2||!t.some(r=>r.length===0)||n==null||n.length!==2||s==null||s.kind!=="ref"||s.name!==e.name||n[0].kind==="ref"&&n[0].debt!=null)throw new Error(`${z()}: internal \u2014 repeat loop '${e.name}' is not \`item self / (empty)\``);return n[0]}function ze(e,t,n){t.length===0?delete e.a:e.a=t.length===1?t[0]:t,e.k!=null&&(delete e.k.node$,delete e.k.capture$),n!=null&&(e.k={...e.k??{},...n}),e.k!=null&&Object.keys(e.k).length===0&&delete e.k}function Ms(e,t,n){t==null?ze(e,[]):ze(e,["@push$"],n.has(t)?void 0:{push$:{src:!0}})}function ri(e,t,n,s,r,i,a,o,l="helper",c,f,u,h,d,p=new Set,b=new Set,m=!1){let w=an(t,n,s),g=v=>v===0?e:`${e}$step${v}`,y=u?w.map(v=>v.ref!=null):[],_=v=>y[v]?y.slice(0,v).filter(Boolean).length:-1;if(u&&u.kind!=="object"&&u.kind!=="array")throw new ae(`${z()}: rule '${f??e}' has a value annotation of unknown kind '${u.kind}'. A rule builds an 'object' or an 'array'.`,{rule:f??e,sp:d});if(u&&u.kind==="object"){let v=y.filter(Boolean).length,x=u.members?.length??0;if(x!==v)throw new ae(`${z()}: rule '${f??e}' names ${x} member${x===1?"":"s"} but builds ${v}. A value annotation names one member per part that produces a value. A part made only of literals produces none \u2014 and note that a part whose own rule is a single terminal stops being a part here in two ways: as a LEADING part it is folded into this rule by left-recursion elimination, and anywhere else it becomes a named lexer token. Giving that rule a body that is not a bare terminal (a repetition, a group, or more than one element) keeps it nameable.`,{rule:f??e,sp:d})}if(u&&h!=null){let v=y.filter(Boolean).length;if(h.length!==v)throw new ae(`${z()}: rule '${f??e}' has a value annotation for ${h.length} part${h.length===1?"":"s"} but builds ${v}. A rewrite pass changed how many parts of this rule produce a value, so the annotation no longer describes it. A part whose own rule is a single literal is the usual cause: it becomes a lexer token here and stops being a part at all. Give that rule a body that is not a bare terminal.`,{rule:f??e,sp:d})}for(let v=0;v<w.length;v++){let x=g(v),S=w[v],O=v===0?l:"helper",$=Qt(S,r,a,v===0,x,O);v===0&&l==="user"&&a.emitMarks&&($.m=Ei(t,n,s));let ee=[$],I={open:ee};if(0<v&&c!=null&&f!=null&&c.set(x,f),v===w.length-1?S.ref&&(I.close=[{...on(a,x,O),g:r}]):I.close=[{r:g(v+1),...on(a,x,O),g:r}],m){ze(ee[0],[]);let j=S.ref!=null&&!p.has(S.ref)?S.ref:null;for(let C of I.close??[])Ms(C,j,b)}if(u){let j=u.kind==="array",C=_(v),V=0<=C?u.members?.[C]:void 0,H=[],K={};v===0&&H.push(j?"@array$":"@object$"),!j&&V!=null&&(H.push("@key$"),K.key$={lit:V}),ze(ee[0],H,K);let re=j&&S.ref!=null&&p.has(S.ref);if(0<=C&&!re){let Z=h?.[C]===!0,he=j?"@push$":"@setval$",ve=Z?void 0:{[j?"push$":"setval$"]:{src:!0}};I.close==null&&(I.close=[{g:r}]);for(let Ie of I.close)ze(Ie,[he],ve)}else if(I.close!=null)for(let Z of I.close)ze(Z,[])}Ge(i,x,I,o)}}function Ul(e,t,n,s,r){let i=new Map,a=new Set;for(let l of e.productions){let c=s.get(l.name);c!=null&&(r.begin(bt(ne(l)),ne(l),l.sp,qe.first),r.charge(1)),i.set(l.name,c==null?new Set:new Set([c]))}let o=!0;for(;o;){o=!1;for(let l of e.productions){if(s.has(l.name))continue;let c=i.get(l.name);r.begin(bt(ne(l)),ne(l),l.sp,qe.first);for(let f of l.alts){let u=!0;for(let h of f){if(h.kind==="term"||h.kind==="regex"||h.kind==="token"){let d=h.kind==="term"?t.get(Oe(h)):h.kind==="token"?h.name:n.get(Fe(h));c.has(d)||(r.charge(1),c.add(d),o=!0),u=!1;break}if(h.kind==="ref"){let d=i.get(h.name)??new Set;for(let p of d)c.has(p)||(r.charge(1),c.add(p),o=!0);if(!a.has(h.name)){u=!1;break}continue}throw new Error(`${z()}: internal \u2014 unexpected kind in FIRST: ${h.kind}`)}u&&!a.has(l.name)&&(a.add(l.name),o=!0)}}}return{firstSets:i,nullable:a}}function Dl(e,t,n,s,r,i){let a=e.productions.filter(o=>o.debtGuard!=null);if(a.length!==0)for(let o of a){let l=o.debtGuard,c=e.productions.find(p=>p!==o&&p.alts.some(b=>b.some(m=>m.kind==="ref"&&m.name===o.name))),f=s.get(o.name)??new Set;if(c==null||f.size===0){delete o.debtGuard;continue}let u=Kl(e,c.name),h=[],d=new Set;for(let p of e.productions)for(let b of p.alts)for(let m=0;m<b.length;m++){let w=b[m];if(w.kind!=="ref"||!u.has(w.name))continue;let g=b.slice(m+1);if(g.length===0)continue;let y=Cs(g,t,n,s,r);if(y.nullable)continue;let _=!1;for(let v of y.tokens)for(let x of f)(x===v||i(x,v))&&(d.add(x),_=!0);h.push({alt:b,i:m,delta:_?1:0})}if(d.size===0){delete o.debtGuard;continue}o.debtOwed=[...d];for(let{alt:p,i:b,delta:m}of h){let w=p[b];p[b]={...w,debt:{...w.debt??{},[l]:m}}}}}function Kl(e,t){let n=new Map;for(let i of e.productions){let a=new Set;for(let o of i.alts)nn(o,a);i.probeDispatch&&(a.add(i.probeDispatch.probeRule),a.add(i.probeDispatch.withBranch),a.add(i.probeDispatch.noBranch));for(let o of a){let l=n.get(o);l?l.push(i.name):n.set(o,[i.name])}}let s=new Set([t]),r=[t];for(;0<r.length;)for(let i of n.get(r.pop())??[])s.has(i)||(s.add(i),r.push(i));return s}function Cs(e,t,n,s,r){let i=new Set;for(let a of e){if(a.kind==="term"||a.kind==="regex"||a.kind==="token")return i.add(a.kind==="term"?t.get(Oe(a)):a.kind==="token"?a.name:n.get(Fe(a))),{tokens:i,nullable:!1};if(a.kind==="ref"){for(let o of s.get(a.name)??[])i.add(o);if(!r.has(a.name))return{tokens:i,nullable:!1};continue}throw new Error(`${z()}: internal \u2014 unexpected kind in firstOfSeq: ${a.kind}`)}return{tokens:i,nullable:!0}}function Xl(e,t,n,s,r,i,a){let o=new Map,l=new Map;for(let h of e.productions)o.set(h.name,new Set),l.set(h.name,h);let c=h=>{let d=l.get(h);a.begin(bt(ne(d)),ne(d),d.sp,qe.follow)},f=o.get(i);f!=null&&(c(i),a.charge(1),f.add("#ZZ"));let u=!0;for(;u;){u=!1;for(let h of e.productions){let d=o.get(h.name);for(let p of h.alts)for(let b=0;b<p.length;b++){let m=p[b];if(m.kind!=="ref")continue;let w=o.get(m.name);if(!w)continue;c(m.name);let g=_=>{w.has(_)||(a.charge(1),w.add(_),u=!0)},y=Cs(p.slice(b+1),t,n,s,r);for(let _ of y.tokens)g(_);if(y.nullable)for(let _ of d)g(_)}}}return o}function Hl(e,t,n,s,r,i,a){let o=new Map,l=new Map;for(let h of e.productions)o.set(h.name,new Map),l.set(h.name,h);let c=h=>h.kind==="term"?t.get(Oe(h)):h.kind==="token"?h.name:h.kind==="regex"?n.get(Fe(h)):void 0,f=(h,d,p)=>{let b=o.get(h);if(!b)return!1;let m=b.get(d);return m||(m=new Set,b.set(d,m)),m.has(p)?!1:(a.charge(1),m.add(p),!0)},u=!0;for(;u;){u=!1;for(let h of e.productions){let d=i.get(h.name)??new Set,p=o.get(h.name);for(let b of h.alts)for(let m=0;m<b.length;m++){let w=b[m];if(w.kind!=="ref"||!o.has(w.name))continue;let g=l.get(w.name);a.begin(bt(ne(g)),ne(g),g.sp,qe.pairs);let y=m+1,_=!1;for(;y<b.length;){let v=b[y];if(v.kind==="ref"){if(r.has(v.name)){y++;continue}_=!0;break}let x=c(v);if(x==null){_=!0;break}let S=Cs(b.slice(y+1),t,n,s,r);for(let O of S.tokens)f(w.name,x,O)&&(u=!0);if(S.nullable)for(let O of d)f(w.name,x,O)&&(u=!0);_=!0;break}if(!_)for(let[v,x]of p)for(let S of x)f(w.name,v,S)&&(u=!0)}}}return o}function Yl(e,t){if(e==="")return-1;let n=e[0];if(n==="["){let r=1;for(e[r]==="^"&&r++,e[r]==="]"&&r++;r<e.length&&e[r]!=="]";)r+=e[r]==="\\"?2:1;return r<e.length?r+1:-1}if(n==="\\"){let r=zl(e,0,t);return r??-1}return"(.|)?*+{".includes(n)?-1:e.codePointAt(0)>65535?2:1}function Oi(e,t,n){let s=e[t+1];if(s===void 0)return null;let r=/[uv]/.test(n);if(s==="u"&&e[t+2]==="{"&&r){let a=e.indexOf("}",t+3);if(a<0)return null;let o=e.slice(t+3,a);if(!/^[0-9A-Fa-f]{1,6}$/.test(o))return null;let l=parseInt(o,16);return 1114111<l?null:[a+1-t,l]}if(s==="u"||s==="x"){let a=s==="u"?4:2,o=e.slice(t+2,t+2+a);if(a!==o.length||!/^[0-9A-Fa-f]+$/.test(o))return r?null:[2,s.charCodeAt(0)];let l=parseInt(o,16);if(r&&55296<=l&&l<=56319&&e.slice(t+6,t+8)==="\\u"){let c=e.slice(t+8,t+12),f=/^[0-9A-Fa-f]{4}$/.test(c)?parseInt(c,16):-1;if(56320<=f&&f<=57343)return[12,65536+(l-55296<<10)+(f-56320)]}return[2+a,l]}if(/[dDwWsSbBnrtfvckpP0-9]/.test(s))return null;let i=e.codePointAt(t+1);return[i>65535?3:2,i]}function zl(e,t,n){let s=Oi(e,t,n);return s==null?null:s[0]}function en(e,t){if(e==="[\\s\\S]")return[[0,1114111]];let n=0,s=()=>{let f=e[n];if(f===void 0)return null;if(f==="\\"){let h=Oi(e,n,t);return h==null?null:(n+=h[0],h[1])}let u=e.codePointAt(n);return n+=u>65535?2:1,u};if(e[0]!=="["){let f=s();return f==null?null:[[f,f]]}n=1;let r=!1;e[n]==="^"&&(r=!0,n++);let i=[],a=!/[uv]/.test(t),o=f=>{if(a&&65535<f){let u=55296+(f-65536>>10),h=56320+(f-65536&1023);i.push([u,u],[h,h])}};for(;n<e.length&&e[n]!=="]";){let f=s();if(f==null)return null;if(o(f),e[n]==="-"&&e[n+1]!=="]"&&n+1<e.length){n++;let u=s();if(u==null)return null;o(u),i.push([f,u])}else i.push([f,f])}if(e[n]!=="]")return null;if(!r)return i;i.sort((f,u)=>f[0]-u[0]);let l=[],c=0;for(let[f,u]of i)c<f&&l.push([c,f-1]),u+1>c&&(c=u+1);return c<=1114111&&l.push([c,1114111]),l}function Ft(e,t){if(/[uv]/.test(t))return e;let n=[...e];for(let[s,r]of e){let i=Math.max(s,55296),a=Math.min(r,56319);i<=a&&n.push([65536+(i-55296<<10),65536+(a-55296<<10)+1023])}return n}function ii(e){return e.filter(([t,n])=>t<=56319&&55296<=n).map(([t,n])=>[Math.max(t,55296),Math.min(n,56319)])}function Vl(e){let t=[...e],n=65,s=90,r=97,i=122,a=r-n;for(let[o,l]of e){let c=Math.max(o,n),f=Math.min(l,s);c<=f&&t.push([c+a,f+a]);let u=Math.max(o,r),h=Math.min(l,i);u<=h&&t.push([u-a,h-a])}return t}function Wl(e){let t=new Map,n=new Set;for(let a of e){if(a.kind!=="regex")continue;let o=Fe(a);if(t.has(o))continue;let l=Jl(a.pattern,a.flags);l!=null&&(t.set(o,Kn(l)),/[uv]/.test(a.flags)||n.add(o))}let s=Kn([...t].filter(([a])=>!n.has(a)).flatMap(([,a])=>ii(a)));for(let a of n){let o=ii(t.get(a));kt(o,s)&&t.delete(a)}let r=new Set;for(let[a,o]of t)for(let[l,c]of t)if(l!==a&&kt(o,c)){r.add(a);break}let i=r.size===0?[]:tc([...r].map(a=>t.get(a)));return{coverage:t,contested:r,atoms:i,atomTokens:new Map}}function Zl(e,t,n,s,r,i,a,o,l){let c=(b,m)=>{let w=new RegExp("^"+kl(b),m);return w.eager$=!0,w},f=Xn("rx_"+e.pattern,o);s.set(t,f);let u=c(e.pattern,e.flags);if(!n.contested.has(t)){a[f]=u;return}let h=/[uv]/.test(e.flags),d=n.coverage.get(t),p=[];l.begin(`the character class /${e.pattern}/`,void 0,e.sp,qe.tokenSet);for(let b of n.atoms){if(!d.some(([g,y])=>g<=b[0]&&b[1]<=y))continue;let m=b[0]+"-"+b[1],w=n.atomTokens.get(m);if(w==null){let{pattern:g,unicode:y}=nc(b[0],b[1],h);w=Xn("rxa_"+g,o),a[w]=c(g,y?"u":""),n.atomTokens.set(m,w)}l.charge(1),p.push(w)}r[f.replace(/^#/,"")]=p,i.set(f,Ft(d,e.flags))}function Jl(e,t){let n=ec(e,t);return n!=null&&Ql(n,t)?null:n}function Ql(e,t){return!/[uv]/.test(t)&&e.some(([,n])=>65535<n)}function ec(e,t){if(t.includes("i"))return null;if(e==="[\\s\\S]")return en(e,t);if(e.startsWith("[")){let s=1;for(e[s]==="^"&&s++;s<e.length;s++){if(e[s]==="\\"){s++;continue}if(e[s]==="]")break}return s!==e.length-1?null:en(e,t)}return(/[uv]/.test(t)?/^(?:\\u\{[0-9A-Fa-f]{1,6}\}|\\u[dD][89abAB][0-9A-Fa-f]{2}\\u[dD][c-fC-F][0-9A-Fa-f]{2}|\\u[0-9A-Fa-f]{4}|\\x[0-9A-Fa-f]{2}|\\[^ux]|[^\\[\]()|*+?{}^$.])$/:/^(?:\\u[0-9A-Fa-f]{4}|\\x[0-9A-Fa-f]{2}|\\[^ux]|[^\\[\]()|*+?{}^$.])$/).test(e)?en(e,t):null}function tc(e){let t=new Set;for(let r of e)for(let[i,a]of r)t.add(i),t.add(a+1);let n=[...t].sort((r,i)=>r-i),s=[];for(let r=0;r<n.length-1;r++){let i=n[r],a=n[r+1]-1;a<i||e.some(o=>o.some(([l,c])=>l<=i&&a<=c))&&s.push([i,a])}return s}function nc(e,t,n){let s=65535<t||n&&e<=56319&&55296<=t,r=i=>s?"\\u{"+i.toString(16).toUpperCase()+"}":"\\u"+i.toString(16).toUpperCase().padStart(4,"0");return{pattern:"["+r(e)+"-"+r(t)+"]",unicode:s}}function Kn(e){if(e.length<2)return e;let t=e.slice().sort((s,r)=>s[0]-r[0]||s[1]-r[1]),n=[t[0]];for(let s=1;s<t.length;s++){let r=n[n.length-1],i=t[s];i[0]<=r[1]+1?r[1]<i[1]&&(r[1]=i[1]):n.push(i)}return n}function kt(e,t){let n=0,s=0;for(;n<e.length&&s<t.length;){let r=e[n],i=t[s];if(r[0]<=i[1]&&i[0]<=r[1])return!0;r[1]<i[1]?n++:s++}return!1}function mt(e,t,n,s,r){let i=new Set;for(let a of e){if(a.kind==="term"||a.kind==="regex"||a.kind==="token"){let o=a.kind==="term"?t.get(Oe(a)):a.kind==="token"?a.name:n.get(Fe(a));return i.add(o),i}if(a.kind==="ref"){let o=s.get(a.name)??new Set;for(let l of o)i.add(l);if(!r.has(a.name))return i;continue}throw new Error(`${z()}: internal \u2014 unexpected kind in firstOfAlt: ${a.kind}`)}return null}function Hn(e,t,n,s,r,i,a,o,l){l.hold(1);let c=[{tokens:[],done:!1}];for(let f of e){let u=[],h=!1,d=(g,y)=>{l.hold(1+g.length),u.push({tokens:g,done:y}),!y&&g.length<r&&(h=!0)},p=(g,y)=>{a!=null&&g.tokens.length===0&&!a(y)||d([...g.tokens,y],!1)},b,m,w;for(let g of c){if(g.done||g.tokens.length>=r){u.push(g);continue}if(f.kind==="term")p(g,n.get(Oe(f)));else if(f.kind==="regex")p(g,s.get(Fe(f)));else if(f.kind==="token")p(g,f.name);else if(f.kind==="ref"){let y=o?.get(f.name);if(y!=null){p(g,y);continue}if(i.has(f.name)){d(g.tokens,!0);continue}if(b===void 0&&(b=t.productions.find(x=>x.name===f.name)??null,m=new Set(i),m.add(f.name)),!b||b.alts.length===0){d(g.tokens,!0);continue}let _=g.tokens.length,v=w?.get(_);v===void 0&&(v=b.alts.map(x=>Hn(x,t,n,s,r-_,m,_===0?a:void 0,o,l)),(w??=new Map).set(_,v));for(let x of v)for(let S of x)d(S.tokens.length===0?g.tokens:g.tokens.length===0?S.tokens:[...g.tokens,...S.tokens],S.done)}else d(g.tokens,!0)}if(c=u,!h)break}return c}function sc(e,t,n,s,r,i,a){let o=a.held,l=Hn(e,t,n,s,r,new Set,void 0,i,a),c=new Set,f=[],u=0;for(let h of l){let d=h.tokens.join(" ");c.has(d)||(c.add(d),f.push(h.tokens),u+=1+h.tokens.length)}return a.keep(o,u),f}function rc(e,t,n,s,r,i,a,o,l){let c=l.held,f=e.length,u=(q,j,C)=>{let V=l.held,H=Hn(q,t,n,s,j,new Set,C,o,l);return l.settle(V,H),H},h=e.map(q=>q.length===0?[]:u(q,1)),d=h.map(q=>q.some(j=>j.tokens.length===0&&!j.done)),p=h.map(q=>{let j=new Set,C=[];for(let V of q)V.tokens.length!==1||j.has(V.tokens[0])||(j.add(V.tokens[0]),C.push(V.tokens[0]));return C}),b=p.map((q,j)=>{let C=new Set;for(let V of q){let H=!1;for(let K=0;K<f&&!H;K++)if(K!==j){for(let re of p[K])if(i(V,re)){H=!0;break}}for(let K=0;K<a.length&&!H;K++)i(V,a[K][0])&&(H=!0);H&&C.add(V)}return C}),m=e.map((q,j)=>b[j].size===0?[]:u(q,r,C=>b[j].has(C)).filter(C=>0<C.tokens.length)),w=new Map,g=[],y=q=>q.map(j=>{let C=w.get(j);return C===void 0&&(C=g.length,w.set(j,C),g.push(j)),C}),_=m.map(q=>q.map(j=>y(j.tokens))),v=a.map(y),x=g.length,S=x*x<=ic?new Uint8Array(x*x):null,O=(q,j)=>{if(S==null)return i(g[q],g[j]);let C=q*x+j;return S[C]===0&&(S[C]=i(g[q],g[j])?2:1),S[C]===2},$=(q,j)=>{let C=1,V=H=>{let K=Math.min(q.length,H.length),re=0;for(;re<K&&O(q[re],H[re]);)re++;return re===K?!1:(re+1>C&&(C=re+1),!0)};for(let H=0;H<f;H++)if(H!==j){for(let K of _[H])if(!V(K))return q.length}for(let H of v)if(!V(H))return q.length;return C},ee=0,I=e.map((q,j)=>{let C=[],V=new Set,H=K=>{let re=K.join(" ");V.has(re)||(V.add(re),l.hold(1+K.length),ee+=1+K.length,C.push(K))};for(let K of p[j]){if(!b[j].has(K)){H([K]);continue}m[j].forEach((re,Z)=>{re.tokens[0]===K&&H(re.tokens.slice(0,$(_[j][Z],j)))})}return{prefixes:C,nullable:d[j]}});return l.keep(c,ee),I}var ic=1<<22;function ln(e){return e.caseSensitive===!0?!0:!/[A-Za-z]/.test(e.literal)}function Oe(e){return(ln(e)?"cs:":"ci:")+e.literal}function Ai(e){return e.replace(/[\\^$.*+?()[\]{}|]/g,"\\$&")}function Ts(e){return Object.prototype.hasOwnProperty.call(sn,e.slice(1))||e==="#BD"||e==="#ZZ"||e==="#UK"||e==="#AA"||e==="#SP"||e==="#LN"||e==="#CM"}function Xn(e,t,n){if(n&&!Si.test(n)){let o="#"+n;if(!t.has(o)&&!Ts(o))return t.add(o),o}let s=e.replace(/[^A-Za-z0-9]/g,"_").toUpperCase().replace(/^_+|_+$/g,""),r=s.length>0?"#"+s:"#T";if(!t.has(r)&&!Ts(r))return t.add(r),r;let i=1;for(;t.has(r+i);)i++;let a=r+i;return t.add(a),a}});var Li=xe(Le=>{"use strict";Object.defineProperty(Le,"__esModule",{value:!0});Le.ActionError=Le.CompileError=void 0;Le.toRecognitionSpec=Ni;Le.toPureSpec=$i;Le.toJsonic=Ti;Le.attachActions=dc;Le.attachActionSlots=pc;Le.markListing=mc;Le.compileSpec=gc;var Ii=_t(),wt=Ps(),ji=new Set(["a","bo","bc"]),ac=new Set(["@node$","@capture$","@bubble$","@fold$","@object$","@array$","@reset$","@key$","@setval$","@push$","@value$"]),oc=["node$","capture$","fold$","object$","array$","key$","setval$","push$","value$"],cn=class extends Error{constructor(t,n){super(t),this.name="CompileError",this.rules=n}};Le.CompileError=cn;function zn(e){if(e instanceof RegExp)return e;if(Array.isArray(e))return e.map(zn);if(e&&typeof e=="object"){let t={};for(let n of Object.keys(e))typeof e[n]!="function"&&(t[n]=zn(e[n]));return t}return e}function Yn(e,t){if(e instanceof RegExp)return e;if(Array.isArray(e))return e.map(n=>Yn(n,t));if(e&&typeof e=="object"){let n={};for(let s of Object.keys(e)){let r=e[s];if(typeof r!="function"){if(ji.has(s)){if(typeof r=="string"){if(t(r))continue}else if(Array.isArray(r)){let i=r.filter(a=>!(typeof a=="string"&&t(a)));if(i.length===0)continue;n[s]=i.length===1?i[0]:i;continue}}if(s==="k"&&r&&typeof r=="object"){let i=Yn(r,t);for(let a of oc)delete i[a];if(Object.keys(i).length===0)continue;n[s]=i;continue}n[s]=Yn(r,t)}}return n}return e}function lc(e,t){let n=new Set,s=(i,a)=>{if(Array.isArray(i)){i.forEach(o=>s(o,a));return}if(!(!i||typeof i!="object"))for(let o of Object.keys(i)){let l=i[o];!ji.has(o)&&typeof l=="string"&&t(l)?n.add(a):s(l,a)}},r=e.rule??{};for(let i of Object.keys(r))s(r[i],i);return[...n].sort()}function Ni(e){let t=e.ref??{},n=a=>Object.prototype.hasOwnProperty.call(t,a),s=lc(e,n);if(s.length>0)throw new cn(`${(0,wt.diagName)()}: grammar needs control functions (probe / unbounded lookahead) and cannot be emitted as a pure recognition grammar; recompile with \`builtins: true\`. Offending rule(s): `+s.join(", "),s);let r=a=>n(a)||ac.has(a),i=Yn({options:e.options,rule:e.rule},r);return i.v=Ii.BUILTIN_SCHEMA_VERSION,Pi(e,i),Fi(i),i}function $i(e){let t=e.ref??{},n=Object.keys(t);if(n.length>0)throw new cn(`${(0,wt.diagName)()}: spec still contains closures; convert with \`builtins: true\` for pure-data output. Stray ref(s): `+n.slice(0,3).join(", "),[]);let s=zn({options:e.options,rule:e.rule});return s.v=Ii.BUILTIN_SCHEMA_VERSION,Pi(e,s),Fi(s),s}var cc=/^[A-Za-z_$][A-Za-z0-9_$]*$/;function Ti(e,t={}){let n=!!t.strict,s=t.indent??2,r=n?`,
`:`
`,i=d=>" ".repeat(s*d),a={"\b":"\\b","	":"\\t","\n":"\\n","\f":"\\f","\r":"\\r"},o=d=>a[d]??"\\u"+d.charCodeAt(0).toString(16).padStart(4,"0"),l=(d,p)=>p+d.replace(/\\/g,"\\\\").replace(new RegExp(p,"g"),"\\"+p).replace(/[\u0000-\u001f]/g,o)+p,c=d=>l(d,'"'),f=d=>n?c(d):l(d,"'"),u=d=>!n&&cc.test(d)?d:c(d),h=(d,p)=>{if(d==null)return"null";if(d instanceof RegExp){let m=d.eager$?"@~/":"@/";return f(m+d.source+"/"+d.flags)}let b=typeof d;if(b==="number"||b==="boolean")return String(d);if(b==="string")return f(d);if(Array.isArray(d))return d.length===0?"[]":`[
`+d.map(w=>i(p+1)+h(w,p+1)).join(r)+`
`+i(p)+"]";if(b==="object"){let m=Object.keys(d);return m.length===0?"{}":`{
`+m.map(g=>i(p+1)+u(g)+": "+h(d[g],p+1)).join(r)+`
`+i(p)+"}"}return"null"};return h(e,0)}var tt=class extends Error{constructor(t){super(t),this.name="ActionError"}};Le.ActionError=tt;var fc=new Set(["bo","ao","bc","ac"]);function uc(e,t){let n=typeof e=="function"?e:null;return(s,r,i)=>{n&&n(s,r,i);for(let a of t)a(s,r,i)}}function hc(e){return e.length===1?e[0]:(t,n,s)=>{for(let r of e)r(t,n,s)}}function Ri(e,t){return e==null?t:Array.isArray(e)?[...e,t]:[e,t]}function Mi(e){return Array.isArray(e)?e:e&&e.alts||[]}function Ci(e,t){if(t.includes("$"))throw new tt(`${(0,wt.diagName)()}: '$' is reserved for engine builtins; user action ref '${t}' may not contain '$'`);let n=/^@([^:]+):(.+)$/.exec(t);if(!n)throw new tt(`${(0,wt.diagName)()}: malformed action ref '${t}' (expected @rule:phase or @rule:o|c:mark)`);let s=n[1],r=n[2],i=e.rule??{};if(!i[s])throw new tt(`${(0,wt.diagName)()}: action ref '${t}' targets unknown rule '${s}'`);if(fc.has(r))return{phase:r};let a=/^([oc]):(.+)$/.exec(r);if(!a)throw new tt(`${(0,wt.diagName)()}: malformed action ref '${t}'`);let o=a[1]==="o"?"open":"close",l=a[2],c=Mi(i[s][o]).filter(f=>f&&f.m===l);if(c.length===0)throw new tt(`${(0,wt.diagName)()}: action ref '${t}' matches no ${o} alt with mark '${l}' in rule '${s}'`);return{alts:c,rule:s}}function dc(e,t){let n=e.ref=e.ref??{},s=0;for(;`@bnf_user${s}`in n;)s++;for(let r of Object.keys(t)){let i=[].concat(t[r]),a=Ci(e,r);if("phase"in a){let l=`@${/^@([^:]+):/.exec(r)[1]}-${a.phase}`;n[l]=uc(n[l],i);continue}for(let o of a.alts){let l=`@bnf_user${s++}`;n[l]=hc(i),o.a=Ri(o.a,l)}}return e}function pc(e,t){for(let n of t){let s=Ci(e,n);if("phase"in s)throw new tt(`${(0,wt.diagName)()}: slot '${n}' is a rule-phase ref; slots are for @rule:o|c:mark alt actions`);for(let r of s.alts)r.a=Ri(r.a,n)}return e}function mc(e){let t=[],n=e.rule??{};for(let s of Object.keys(n)){let r=n[s];if(r!=null)for(let[i,a]of[["open","o"],["close","c"]]){let o=r[i],l=Array.isArray(o)?o:o&&o.alts||[];for(let c of l)if(c&&c.m!=null){let f=c.s?`s:${c.s}`:c.p?`p:${c.p}`:"(empty)";t.push(`${s}  ${a}:${c.m}  ${f}`)}}}return t.join(`
`)}function gc(e,t={}){let n=t.recognition===!1?$i(e):Ni(e);return Ti(n,{strict:t.strict,indent:t.indent})}function Pi(e,t){e.meta!=null&&(t.meta=zn(e.meta))}function Fi(e){let t=e.rule??{};for(let n of Object.keys(t))for(let s of["open","close"])for(let r of Mi(t[n]?.[s]))r&&typeof r=="object"&&delete r.m}});var Bi=xe(U=>{"use strict";Object.defineProperty(U,"__esModule",{value:!0});U.VERSION=U.ActionError=U.CompileError=U.markListing=U.attachActionSlots=U.attachActions=U.toJsonic=U.toPureSpec=U.toRecognitionSpec=U.compileSpec=U.isProseName=U.REMOVE_ALL=U.REMOVE_PROSE=U.MAX_EMIT_UNITS=U.MAX_LEFT_RECURSION_ELEMENTS=U.MAX_LEFT_RECURSION_EXPANSION=U.MAX_REPEAT_EXPANSION=U.BUILTIN_TOKENS=U.isEffectivelyCaseSensitive=U.termKey=U.escapeRegExp=U.refsIn=U.eliminateLeftRecursion=U.emitGrammarSpec=U.EmitError=void 0;var $e=Ps();Object.defineProperty(U,"EmitError",{enumerable:!0,get:function(){return $e.EmitError}});Object.defineProperty(U,"emitGrammarSpec",{enumerable:!0,get:function(){return $e.emitGrammarSpec}});Object.defineProperty(U,"eliminateLeftRecursion",{enumerable:!0,get:function(){return $e.eliminateLeftRecursion}});Object.defineProperty(U,"refsIn",{enumerable:!0,get:function(){return $e.refsIn}});Object.defineProperty(U,"escapeRegExp",{enumerable:!0,get:function(){return $e.escapeRegExp}});Object.defineProperty(U,"termKey",{enumerable:!0,get:function(){return $e.termKey}});Object.defineProperty(U,"isEffectivelyCaseSensitive",{enumerable:!0,get:function(){return $e.isEffectivelyCaseSensitive}});Object.defineProperty(U,"BUILTIN_TOKENS",{enumerable:!0,get:function(){return $e.BUILTIN_TOKENS}});Object.defineProperty(U,"MAX_REPEAT_EXPANSION",{enumerable:!0,get:function(){return $e.MAX_REPEAT_EXPANSION}});Object.defineProperty(U,"MAX_LEFT_RECURSION_EXPANSION",{enumerable:!0,get:function(){return $e.MAX_LEFT_RECURSION_EXPANSION}});Object.defineProperty(U,"MAX_LEFT_RECURSION_ELEMENTS",{enumerable:!0,get:function(){return $e.MAX_LEFT_RECURSION_ELEMENTS}});Object.defineProperty(U,"MAX_EMIT_UNITS",{enumerable:!0,get:function(){return $e.MAX_EMIT_UNITS}});Object.defineProperty(U,"REMOVE_PROSE",{enumerable:!0,get:function(){return $e.REMOVE_PROSE}});Object.defineProperty(U,"REMOVE_ALL",{enumerable:!0,get:function(){return $e.REMOVE_ALL}});Object.defineProperty(U,"isProseName",{enumerable:!0,get:function(){return $e.isProseName}});var nt=Li();Object.defineProperty(U,"compileSpec",{enumerable:!0,get:function(){return nt.compileSpec}});Object.defineProperty(U,"toRecognitionSpec",{enumerable:!0,get:function(){return nt.toRecognitionSpec}});Object.defineProperty(U,"toPureSpec",{enumerable:!0,get:function(){return nt.toPureSpec}});Object.defineProperty(U,"toJsonic",{enumerable:!0,get:function(){return nt.toJsonic}});Object.defineProperty(U,"attachActions",{enumerable:!0,get:function(){return nt.attachActions}});Object.defineProperty(U,"attachActionSlots",{enumerable:!0,get:function(){return nt.attachActionSlots}});Object.defineProperty(U,"markListing",{enumerable:!0,get:function(){return nt.markListing}});Object.defineProperty(U,"CompileError",{enumerable:!0,get:function(){return nt.CompileError}});Object.defineProperty(U,"ActionError",{enumerable:!0,get:function(){return nt.ActionError}});U.VERSION="0.1.30"});var Di=xe(Te=>{"use strict";Object.defineProperty(Te,"__esModule",{value:!0});Te.GbnfCompileError=Te.GbnfParseError=Te.gbnfRules=Te.eliminateLeftRecursion=Te.emitGrammarSpec=void 0;Te.gbnf=qc;Te.parseGbnf=Ui;var Gs=Bi();Object.defineProperty(Te,"emitGrammarSpec",{enumerable:!0,get:function(){return Gs.emitGrammarSpec}});Object.defineProperty(Te,"eliminateLeftRecursion",{enumerable:!0,get:function(){return Gs.eliminateLeftRecursion}});function yt(e){if(e==null||e.sI==null)return;let t=e.len!=null?e.len:e.src?String(e.src).length:0;return{s:e.sI,e:e.sI+t,r:e.rI,c:e.cI}}function bc(e,t){let n=yt(e),s=yt(t);return n==null?s:s==null?n:{s:n.s,e:s.e,r:n.r,c:n.c}}var fn="[ \\t\\r\\n]",Gi="\\{"+fn+"*([0-9]+)"+fn+"*(?:,"+fn+"*([0-9]*)"+fn+"*)?\\}",qi=Gi.replace(/\(\[0-9\]/g,"(?:[0-9]"),Ls={gbnf:{bo:e=>{e.node=[]},open:[{s:"#ZZ",g:"empty"},{p:"prod"}],close:[{s:"#ZZ"}]},prod:{open:[{s:"#NM #DEF",a:e=>{e.u.name=e.o[0].src,e.u.nameTkn=e.o[0]},p:"alts"}],close:[{s:"#NM #DEF",b:2,r:"prod"},{b:1}],bc:e=>{e.child&&e.child.node!==void 0&&e.node.push({name:e.u.name,alts:e.child.node,sp:yt(e.u.nameTkn)})}},alts:{bo:e=>{e.node=[]},open:[{p:"seq"}],close:[{s:"#ALT",p:"seq"},{b:1}],bc:e=>{e.child&&e.child.node!==void 0&&e.node.push(e.child.node)}},seq:{bo:e=>{e.node=[]},open:[{s:"#NM #DEF",b:2,g:"end"},{s:"#ALT",b:1,g:"end"},{s:"#RP",b:1,g:"end"},{s:"#ZZ",b:1,g:"end"},{p:"elem"}],close:[{s:"#NM #DEF",b:2,g:"end"},{s:"#ALT",b:1,g:"end"},{s:"#RP",b:1,g:"end"},{s:"#ZZ",b:1,g:"end"},{p:"elem"}]},elem:{open:[{p:"atom"}],close:[{s:"#POST",a:e=>{let t=e.child.node;t!==void 0&&e.node.push(Ic(t,e.c[0].src))}},{a:e=>{let t=e.child.node;t!==void 0&&e.node.push(t)}}]},atom:{bo:e=>{e.node=void 0,e.u.grouped=!1},open:[{s:"#GS",a:e=>{let t=Oc(e.o[0].src);t.length>0&&(e.node={kind:"term",literal:t,caseSensitive:!0,sp:yt(e.o[0])})}},{s:"#CC",a:e=>{e.node=Ac(e.o[0].src,e.o[0])}},{s:"#DOT",a:e=>{e.node={kind:"regex",pattern:"[\\s\\S]",flags:"u",sp:yt(e.o[0])}}},{s:"#TOK",a:e=>{let t=e.o[0].src;e.node={kind:"tokterm",text:t,negated:t[0]==="!",sp:yt(e.o[0])}}},{s:"#NM",a:e=>{e.node={kind:"ref",name:e.o[0].src,sp:yt(e.o[0])}}},{s:"#LP",a:e=>{e.u.grouped=!0,e.u.open=e.o[0]},p:"alts"}],close:[{s:"#RP",c:e=>e.u.grouped===!0,a:e=>{e.node={kind:"group",alts:e.child.node,sp:bc(e.u.open,e.c0)}}},{b:1}]}};Te.gbnfRules=Ls;var Vn=null;function kc(){if(Vn)return Vn;let{Tabnas:e}=_t(),t=new e({rule:{start:"gbnf"},fixed:{token:{"#OB":null,"#CB":null,"#OS":null,"#CS":null,"#CL":null,"#CA":null,"#DEF":"::=","#ALT":"|","#LP":"(","#RP":")","#DOT":"."}},match:{token:wc({"#GS":/^"(?:\\[\s\S]|[^"\\])*"/,"#CC":/^\[(?:\\[\s\S]|[^\]\\])*\]/,"#POST":new RegExp("^(?:[*+?]|"+qi+")(?:"+fn+"*(?:[*+?]|"+qi+"))*"),"#TOK":/^!?<(?:\\[\s\S]|[^>\\])*>/,"#NM":/^[A-Za-z0-9_-]+/})},number:{lex:!1},string:{lex:!1},text:{lex:!1},value:{lex:!1},comment:{def:{hash:{line:!0,start:"#",lex:!0,eatline:!1},slash:null,multi:null}}}),n=t.rule();for(let s of Object.keys(n))t.rule(s,null);for(let s of Object.keys(Ls)){let r=Ls[s];t.rule(s,i=>{r.bo&&i.bo(r.bo),r.bc&&i.bc(r.bc),r.open&&i.open(r.open),r.close&&i.close(r.close)})}return Vn=s=>t.parse(s),Vn}function wc(e){for(let t of Object.values(e))t.eager$=!0;return e}var Be=class extends Error{constructor(t,n,s){super(t),this.name="GbnfParseError",this.line=n?.line,this.column=n?.column,this.cause=s}};Te.GbnfParseError=Be;var jt=class extends Error{constructor(t,n,s){super(t),this.name="GbnfCompileError",this.rule=n,s!=null&&(this.sp=s)}};Te.GbnfCompileError=jt;function Ui(e){let t=kc(),n;try{n=t(e)??[]}catch(r){if(r instanceof Be)throw r;let i=r?.lineNumber??r?.row,a=r?.columnNumber??r?.col,o=i!=null&&a!=null?` at line ${i}, column ${a}`:"",l=r?.message?String(r.message).split(`
`)[0]:String(r);throw new Be(`gbnf: parse error${o}: ${l}`,{line:i,column:a},r)}if(!Array.isArray(n)||n.length===0)throw new Be("gbnf: no productions found");let s=yc(n);return xc(s),vc(s),Sc(s),{productions:s}}function yc(e){let t=new Map,n=[];for(let s of e)t.has(s.name)||n.push(s.name),t.set(s.name,s);return n.map(s=>t.get(s))}function xc(e){let t=(n,s)=>{if(n.kind==="tokterm")throw new jt(`gbnf: rule '${s}' uses the tokenizer-token terminal '${n.text}'. These match a sampler's vocabulary entries rather than characters, so they have no meaning for a text parser and are not compiled. Remove them, or describe the same text with a string literal or character class.`,s,n.sp);if(n.kind==="group")for(let r of n.alts)for(let i of r)t(i,s);else(n.kind==="opt"||n.kind==="star"||n.kind==="plus"||n.kind==="rep")&&t(n.inner,s)};for(let n of e)for(let s of n.alts)for(let r of s)t(r,n.name)}function vc(e){if(!e.some(t=>t.name==="root")){let t=e.map(n=>n.name).join(", ");throw new jt(`gbnf: no 'root' rule. GBNF requires a rule named 'root'; it is the start symbol, and the whole input must match it. Defined rules: ${t}.`,"root")}}function Sc(e){let t=new Set(e.map(s=>s.name)),n=(s,r)=>{if(s.kind==="ref"){if(!t.has(s.name))throw new jt(`gbnf: rule '${r}' references '${s.name}', which is never defined.`,r,s.sp)}else if(s.kind==="group")for(let i of s.alts)for(let a of i)n(a,r);else(s.kind==="opt"||s.kind==="star"||s.kind==="plus"||s.kind==="rep")&&n(s.inner,r)};for(let s of e)for(let r of s.alts)for(let i of r)n(i,s.name)}var _c={t:"	",r:"\r",n:`
`,"\\":"\\",'"':'"',"[":"[","]":"]","-":"-"},Ec={x:2,u:4,U:8};function Bs(e,t){if(e[t]!=="\\"){let i=e.codePointAt(t);return{cp:i,next:t+(i>65535?2:1)}}let n=e[t+1];if(n===void 0)throw new Be(`gbnf: trailing backslash in terminal ${e}`);let s=_c[n];if(s!==void 0)return{cp:s.codePointAt(0),next:t+2};let r=Ec[n];if(r!==void 0){let i=e.slice(t+2,t+2+r);if(i.length<r||!/^[0-9a-fA-F]+$/.test(i))throw new Be(`gbnf: escape '\\${n}' in terminal ${e} needs ${r} hex digits, found '${i}'`);let a=parseInt(i,16);if(a>1114111)throw new Be(`gbnf: escape '\\${n}${i}' in terminal ${e} is ${a}, which is not a Unicode code point (the maximum is \\U0010FFFF)`);return{cp:a,next:t+2+r}}throw new Be(`gbnf: unknown escape '\\${n}' in terminal ${e}. GBNF escapes are \\t \\r \\n \\\\ \\" \\[ \\] \\- \\xXX \\uXXXX \\UXXXXXXXX.`)}function Oc(e){let t="",n=1,s=e.length-1;for(;n<s;){let{cp:r,next:i}=Bs(e,n);t+=String.fromCodePoint(r),n=i}return t}function Ac(e,t){let n=1,s=e.length-1,r=!1;e[n]==="^"&&(r=!0,n++);let i=[],a=!1;for(;n<s;){let o=Bs(e,n);if(n=o.next,e[n]==="-"&&n+1<s){let l=Bs(e,n+1);if(n=l.next,l.cp<o.cp)throw new Be(`gbnf: character class ${e} has a descending range (U+${o.cp.toString(16).toUpperCase()} to U+${l.cp.toString(16).toUpperCase()})`);a=a||65535<o.cp||65535<l.cp,i.push(Fs(o.cp)+"-"+Fs(l.cp))}else a=a||65535<o.cp,i.push(Fs(o.cp))}if(i.length===0)throw new Be(`gbnf: empty character class ${e} matches nothing`);return{kind:"regex",sp:yt(t),pattern:"["+(r?"^":"")+i.join("")+"]",flags:r||a?"u":""}}function Fs(e){return 65535<e?"\\u{"+e.toString(16)+"}":"\\u"+e.toString(16).padStart(4,"0")}function Ic(e,t){let n=new RegExp("[*+?]|"+Gi,"g"),s=e,r;for(;(r=n.exec(t))!==null;)if(r[0][0]==="*")s={kind:"star",inner:s};else if(r[0][0]==="+")s={kind:"plus",inner:s};else if(r[0][0]==="?")s={kind:"opt",inner:s};else{let i=parseInt(r[1],10),a=r[2]===void 0?i:r[2]===""?1/0:parseInt(r[2],10);s=jc(s,i,a,r[0])}return s}function jc(e,t,n,s){if(n<t)throw new Be(`gbnf: repetition ${s} has an upper bound below its lower bound`);return t===1&&n===1?e:t===0&&n===1/0?{kind:"star",inner:e}:t===1&&n===1/0?{kind:"plus",inner:e}:t===0&&n===1?{kind:"opt",inner:e}:{kind:"rep",min:t,max:n,inner:e}}function Nc(e){let t=e.options??{};return t.tokenSet={...t.tokenSet??{},IGNORE:[]},t.space={lex:!1},t.line={lex:!1},t.comment={lex:!1},t.string={lex:!1},t.number={lex:!1},t.text={lex:!1},t.value={lex:!1},$c(),t.lex={...t.lex??{},relex:!0},e.options=t,e}var Wn=null;function $c(){if(Wn==null)try{let{Tabnas:e}=_t();Wn=new e({lex:{relex:!0}}).internal().config.lex.relex===!0}catch{Wn=!1}if(!Wn)throw new jt("this @tabnas/parser is too old \u2014 it does not implement negotiated lexing (lex.relex), which GBNF needs because its grammars are scannerless: one character can legitimately be a different token for different alternatives. Upgrade @tabnas/parser.")}var qs=1114111;function Tc(e){let t=e.slice().sort((s,r)=>s[0]-r[0]),n=[];for(let[s,r]of t){let i=n[n.length-1];i&&s<=i[1]+1?i[1]=Math.max(i[1],r):n.push([s,r])}return n}function Rc(e){let t=[],n=0;for(let[s,r]of e)n<s&&t.push([n,s-1]),n=r+1;return n<=qs&&t.push([n,qs]),t}function Mc(e,t){let n=0,s=0;for(;n<e.length&&s<t.length;)if(e[n][1]<t[s][0])n++;else if(t[s][1]<e[n][0])s++;else return!0;return!1}function Cc(e,t){for(let[n,s]of e){if(t<n)return!1;if(t<=s)return!0}return!1}function Pc(e){if(e==="[\\s\\S]")return[[0,qs]];if(e[0]!=="["||e[e.length-1]!=="]")return null;let t=1,n=!1;e[t]==="^"&&(n=!0,t++);let s=e.length-1,r=[],i=()=>{if(e[t]!=="\\"||e[t+1]!=="u")return null;if(e[t+2]==="{"){let l=e.indexOf("}",t+3);if(l<0)return null;let c=parseInt(e.slice(t+3,l),16);return t=l+1,Number.isFinite(c)?c:null}let o=parseInt(e.slice(t+2,t+6),16);return t+=6,Number.isFinite(o)?o:null};for(;t<s;){let o=i();if(o==null)return null;if(e[t]==="-"){t++;let l=i();if(l==null)return null;r.push([o,l])}else r.push([o,o])}let a=Tc(r);return n?Rc(a):a}function Fc(e){let t=new Map,n=[],s=!0,r=i=>{if(i.kind==="regex"){if(!t.has(i.pattern)){let a=Pc(i.pattern);a==null?s=!1:t.set(i.pattern,a)}}else if(i.kind==="term")0<i.literal.length&&n.push(i.literal.codePointAt(0));else if(i.kind==="group")for(let a of i.alts)for(let o of a)r(o);else(i.kind==="opt"||i.kind==="star"||i.kind==="plus"||i.kind==="rep")&&r(i.inner)};for(let i of e.productions)for(let a of i.alts)for(let o of a)r(o);return{classes:s?t:null,literalHeads:n}}function Lc(e,t){let n=t.options?.match?.token??{},s=Object.keys(n);if(s.length===0)return!1;let{classes:r,literalHeads:i}=Fc(e);if(r==null)return!1;let a=new Set([...r.keys()].map(l=>"^"+l));for(let l of s)if(!a.has(n[l].source))return!1;let o=[...r.values()];for(let l=0;l<o.length;l++){for(let c=l+1;c<o.length;c++)if(Mc(o[l],o[c]))return!1;for(let c of i)if(Cc(o[l],c))return!1}for(let l of s)n[l].eager$=!0;return!0}function Bc(e){let t=e.options?.match?.token??{};for(let n of Object.keys(t))delete t[n].eager$}function qc(e,t){let n=Ui(e),s=t?.start??"root",r=(0,Gs.emitGrammarSpec)(n,{...t,start:s,tag:t?.tag??"gbnf"});return Nc(r),t?.eagerClasses!==!1&&Lc(n,r)||Bc(r),r}});var zi=xe(un=>{"use strict";Object.defineProperty(un,"__esModule",{value:!0});un.GbnfRenderError=void 0;un.renderGbnf=Hc;var Re=class extends Error{constructor(t,n){super(t),this.name="GbnfRenderError",this.rule=n}};un.GbnfRenderError=Re;var Ki=/^[A-Za-z0-9_-]+$/;function Gc(e){let t=String.fromCodePoint(e);return t==='"'?'\\"':t==="\\"?"\\\\":t===`
`?"\\n":t==="\r"?"\\r":t==="	"?"\\t":e<32||127<=e&&e<=159?"\\x"+e.toString(16).toUpperCase().padStart(2,"0"):t}function Xi(e){let t='"';for(let n of e)t+=Gc(n.codePointAt(0));return t+'"'}function Us(e){let t=String.fromCodePoint(e);return t==="]"?"\\]":t==="["?"\\[":t==="\\"?"\\\\":t==="-"?"\\u002D":t==="^"?"\\u005E":t===`
`?"\\n":t==="\r"?"\\r":t==="	"?"\\t":e<32||127<=e&&e<=159?"\\x"+e.toString(16).toUpperCase().padStart(2,"0"):65535<e?"\\U"+e.toString(16).toUpperCase().padStart(8,"0"):t}function Uc(e){if(e[0]!=="["||e[e.length-1]!=="]")return null;let t=1,n=e.length-1,s=!1;e[t]==="^"&&(s=!0,t++);let r=()=>{if(e[t]!=="\\"){let l=e.codePointAt(t);return t+=65535<l?2:1,l}let a=e[t+1];if(a==="u"){if(e[t+2]==="{"){let c=e.indexOf("}",t+3);if(c<0)return null;let f=parseInt(e.slice(t+3,c),16);return t=c+1,Number.isFinite(f)?f:null}let l=e.slice(t+2,t+6);return/^[0-9a-fA-F]{4}$/.test(l)?(t+=6,parseInt(l,16)):null}if(a==="x"){let l=e.slice(t+2,t+4);return/^[0-9a-fA-F]{2}$/.test(l)?(t+=4,parseInt(l,16)):null}let o={n:`
`,r:"\r",t:"	",f:"\f",v:"\v",0:"\0"};return a in o?(t+=2,o[a].codePointAt(0)):a!==void 0&&!/[A-Za-z0-9]/.test(a)?(t+=2,a.codePointAt(0)):null},i=[];for(;t<n;){let a=r();if(a==null)return null;if(e[t]==="-"&&t+1<n){t++;let o=r();if(o==null||o<a)return null;i.push({lo:a,hi:o})}else i.push({lo:a,hi:a})}return i.length===0?null:{negated:s,items:i}}function Dc(e,t){let n=[],s="",r=()=>{0<s.length&&n.push(Xi(s)),s=""};for(let i of e)if(/[a-zA-Z]/.test(i))r(),n.push("["+i.toLowerCase()+i.toUpperCase()+"]");else{if(i.toLowerCase()!==i.toUpperCase())throw new Re(`gbnf: rule '${t}' has a case-insensitive literal containing '${i}' (U+${i.codePointAt(0).toString(16).toUpperCase()}), which has no exact case-insensitive expansion in GBNF. Use a case-sensitive literal, or spell the alternatives as a character class.`,t);s+=i}return r(),n}function Kc(e,t){if(e==="[\\s\\S]")return{text:".",form:"atom"};let n=Uc(e);if(n==null)throw new Re(`gbnf: rule '${t}' has a regex terminal /${e}/ that is not a character class. GBNF's only regex-shaped terminal is [\u2026], so this grammar cannot be rendered faithfully.`,t);let s="["+(n.negated?"^":"");for(let{lo:r,hi:i}of n.items)s+=r===i?Us(r):Us(r)+"-"+Us(i);return{text:s+"]",form:"atom"}}function Hi(e,t){switch(e.kind){case"term":{if(e.literal.length===0)return null;if(e.caseSensitive===!0)return{text:Xi(e.literal),form:"atom"};let n=Dc(e.literal,t);return n.length===0?null:n.length===1?{text:n[0],form:"atom"}:{text:n.join(" "),form:"seq"}}case"ref":{if(!Ki.test(e.name))throw new Re(`gbnf: rule '${t}' references '${e.name}', which is not a legal GBNF rule name ([A-Za-z0-9_-]+).`,t);return{text:e.name,form:"atom"}}case"regex":return Kc(e.pattern,t);case"group":return{text:"("+Yi(e.alts,t)+")",form:"atom"};case"opt":case"star":case"plus":case"rep":{let n=Hi(e.inner,t);if(n==null)throw new Re(`gbnf: rule '${t}' repeats an empty literal, which matches nothing and cannot carry a repetition.`,t);let s=e.kind==="opt"?"?":e.kind==="star"?"*":e.kind==="plus"?"+":e.min===e.max?`{${e.min}}`:e.max===1/0?`{${e.min},}`:`{${e.min},${e.max}}`;return{text:(n.form==="seq"?`(${n.text})`:n.text)+s,form:"postfix"}}case"token":throw new Re(`gbnf: rule '${t}' uses the engine lexer token '${e.name}'. GBNF has no lexical level, so there is no faithful rendering; define the token's language as a rule instead.`,t);case"prose":throw new Re(`gbnf: rule '${t}' contains the prose element <${e.text}>, which describes a language informally and cannot be rendered as GBNF.`,t);default:{let n=e.kind;throw new Re(`gbnf: rule '${t}' contains an IR element of kind '${n}', which this renderer does not know how to spell.`,t)}}}function Xc(e,t){let n=[];for(let s of e){let r=Hi(s,t);r!=null&&n.push(r.text)}return n.join(" ")}function Yi(e,t){return e.map(n=>Xc(n,t)).join(" | ")}function Hc(e,t){let n=e?.productions;if(!Array.isArray(n)||n.length===0)throw new Re("gbnf: no productions to render");let s=new Set;for(let i of n){if(!Ki.test(i.name))throw new Re(`gbnf: production '${i.name}' is not a legal GBNF rule name ([A-Za-z0-9_-]+).`,i.name);if(s.has(i.name))throw new Re(`gbnf: duplicate production '${i.name}'. GBNF replaces a redefined rule, so rendering both would change the grammar.`,i.name);s.add(i.name)}let r=[];if(!s.has("root")){let i=t?.start??n[0].name;if(!s.has(i))throw new Re(`gbnf: start rule '${i}' is not defined, so no 'root' can be synthesized for it.`,i);r.push(`root ::= ${i}`)}for(let i of n)r.push(`${i.name} ::= ${Yi(i.alts,i.name)}`);return r.join(`
`)+`
`}});var Vi=xe(Ds=>{"use strict";Object.defineProperty(Ds,"__esModule",{value:!0});Ds.translate=zc;var Yc=Object.freeze({manifest:`{
  "$schema": "https://tabnas.dev/schema/plugin.schema.json",
  "name": "@tabnas/gbnf",
  "go": "github.com/tabnas/gbnf/go",
  "rust": "tabnas-gbnf",
  "description": "llama.cpp GBNF grammar compiler for the tabnas engine. A host reads a GBNF document by compiling it: the tree it translates is the pure-data GrammarSpec the compiler emits (schema grammar-spec), which the render writes back as GBNF.",
  "base": "@tabnas/bnf",
  "engine": "@tabnas/parser",
  "extensions": [
    ".gbnf"
  ],
  "languageId": "gbnf",
  "clib": {
    "dir": "go/clib",
    "library": "libtabnasgbnf",
    "abi": "v1",
    "errorCodes": [
      "usage",
      "grammar",
      "handle",
      "internal"
    ]
  },
  "errorCodes": [],
  "docs": "https://tabnas.dev/docs/packages",
  "repository": "https://github.com/tabnas/gbnf",
  "versionSource": "ts/package.json",
  "translate": {
    "reads": "tree",
    "writes": "tree",
    "root": "object",
    "schema": "grammar-spec",
    "render": "alchemy/render.alc",
    "loss": [
      "The grammar is written anew from its compiled spec: comments, blank lines and layout are not kept, and each rule is written on one line.",
      "A rule is written as the compiler rewrote it: a reference that led an alternative is written back where the alternatives the compiler put in its place still stand together, each followed by one same tail, and is otherwise written as those alternatives; a left recursion is written as the repetition it became, and alternatives the compiler left-factored with their shared prefix written in each of them again.",
      "Where the compiler reordered a rule's alternatives to tell them apart (a longer lookahead ahead of a shorter one that begins with the same character, a keyword ahead of a character class that can take it), the alternatives that push a helper of the compiler's are put back in the order its numbers record, and the others are written in the compiled order: the rule compiles back the same, and the spec compiled back can differ in the order of the alternates other rules build through it, in the numbers of the compiler's helpers and in the order of its tokens.",
      "A left recursion that ran through another rule (a ::= b, b ::= a \\"+\\" | n) is written as the compiler rewrote it, with the leading reference that closed the cycle left in place, and compiles back to another spec, since the compiler now substitutes that reference.",
      "GBNF starts from the rule named root: a spec whose start rule has another name is written with root ::= and that name first, as render_gbnf writes it, and compiles back with that rule added; a spec that has a rule named root that is not its start rule is refused.",
      "Terminals are written in GBNF's forms, spelled as render_gbnf spells them: a literal as a string, a class as a bracket expression and [\\\\s\\\\S] as a dot, and a rule the compiler made a token of (plus ::= \\"+\\", referenced as plus) as that rule, after the others.",
      "A rule the compiler made a token of, whose name is one the compiler could give its literal by itself (B ::= \\"b\\", or any name of capitals, digits and underscores where the literal holds a character past ASCII), cannot be told from that literal and is written as the literal: it compiles back with the token later in the token table, or under the name the literal gives it.",
      "Repetitions are written in GBNF's forms, x*, x+, x?, x{m}, x{m,} and x{m,n}, with a postfix on a postfix (x*?) where a repetition is itself repeated.",
      "An empty alternative is written as nothing between its bars; in a rule whose alternatives the compiler emits as its open alternates, where it puts the empty one last wherever it stood, it is written first, as llama.cpp's grammars write it.",
      "A spec compiled from another notation compiles back under GBNF's own settings: the group tag on every alternate and GBNF's exact lexing are GBNF's, a case-insensitive literal (ABNF's default) is written as the two-case classes and strings that match exactly what it matches, an RFC 5234 core rule is written as a rule of its own, and an empty literal, which GBNF reads as nothing, as an empty string.",
      "The tree builders every compiled grammar carries (@node$, @capture$, @bubble$ and @fold$, with their k settings) and its marks are not written, since the compiler makes them again from the rules: a spec whose builders or marks are others compiles back with the compiler's own, and recognises what it recognised.",
      "A spec the render cannot write as GBNF is refused with TARGET_VALUE_UNREPRESENTABLE, naming what it met: an action (a value annotation's builders, a user action, the probe dispatcher of an optional prefix), a condition or a counter other than a repetition's, an error generator or an alternate modifier, a function reference where a rule or a count is due, a set of tokens at one place, a removal, a clear or the form that edits a rule already installed, a token no GBNF terminal matches (the engine's own TX, NR, ST and VL, a class whose flags change what it matches (no u on a class that is negated, reaches past U+FFFF or holds every code point, or u on one that holds a surrogate), a pattern that is neither one class nor an escaped literal, a case-insensitive literal holding a character past ASCII that may have cases: one of the Basic Multilingual Plane, or of a script past it that has them), a token set whose tokens are not the class its name gives, a rule with no alternate to open with, a sequence's step with more alternates than a step, a rule the compiler lifted to a token whose name another rule holds, a start that is not the start wrapper every grammar text compiles to (one open alternate that matches nothing and pushes a rule, closed by the end of the source alone), a rule name GBNF cannot spell, the empty name among them, a repetition bounded past what the compiler numbers, a repetition of no copies, whose item the spec does not keep, or a spec that gives its match tokens' order as a list of its own (Go's tokenOrder), whose rules' order, which ranks the tokens, is lost."
    ]
  }
}
`,render:Object.freeze({entry:"gbnf-render",source:`; GBNF's render: a grammar-spec tree, the GrammarSpec the tabnas BNF
; compiler (tabnas-bnf) emits for a grammar, written back as llama.cpp
; GBNF. This is a library of definitions, each named \`gbnf-...\`, which a
; host links with its own program (alchemy's \`compile_sources\`); its entry
; point is \`gbnf-render\`, and nothing else here is the host's to call.
;
; A host reads a GBNF document by compiling it: the grammar-spec tree is
; the pure-data GrammarSpec that tabnas-bnf's \`compileSpec(gbnfConvert(src,
; {builtins: true}), {recognition: false, strict: true})\` writes
; (\`compile_spec\` over \`gbnf_convert\` in Rust, the same text; \`ToJsonic\`
; over \`ToPureSpec\` over \`Gbnf\` in Go, which writes its keys in name
; order), parsed as JSON. Its schema is \`grammar-spec\`, shared with ABNF
; and EBNF, whose compilers emit the same shape; the contract is the round
; trip: the text written here compiles back to the spec it was written
; from. This repository's \`render_gbnf\` (Rust, \`renderGbnf\` in
; TypeScript) writes GBNF from the IR a GBNF document parses to; this
; writes it from the spec the IR compiles to, and spells each terminal,
; group and repetition as that one does.
;
; The spec is a compiled grammar, not the grammar's text, so the render
; reads the compiler's shapes back into the notation:
;
; - A rule the author wrote is a rule of the spec that the spec's
;   \`meta.provenance\` does not name (a spec without it is read by the
;   names the compiler gives its rules, a helper's only where it has
;   the shape of its kind too, and the start wrapper by its shape);
;   every rule it names is the compiler's: a repetition's, an
;   option's or a group's helper (\`_gen<n>_star_...\`, \`_plus_\`, \`_opt_\`,
;   \`_rep_\`, \`_group\`), a sequence's chain steps (\`$alt<i>\`,
;   \`$step<j>\`), a left-factored tail (\`$fact<k>\`) and the start
;   wrapper. A helper is written where it is referenced, as the
;   construct it compiles: a repeat loop (the replace loop every \`x*\`
;   compiles to, its entry \`{c: {n.rep: 0}, r: <self>}\`) as \`x*\`, a plus
;   as \`x+\`, an option as \`x?\`, a counted repetition as \`x{m,n}\` (its
;   nested optionals counted), a group as \`(...)\`. A factored tail is
;   expanded back into the alternatives it was factored from, which the
;   compiler factors again, and alternatives that were each a group,
;   which the compiler factored into the first, are read back as the
;   groups they were.
; - An alternative of a rule is read from the alternates the compiler
;   emitted for it: a chain of steps, one per segment of terminals and a
;   reference; a dispatcher's \`$alt<i>\` rules, the gap in their numbers
;   the empty alternative; or, for a rule whose every alternative is one
;   segment, its open alternates, each read as the tokens it consumes
;   (its \`s\` less the \`b\` it gives back) and the rule it pushes, the
;   lookahead copies the dispatch made of one alternative read as one,
;   the empty alternative first (the compiler puts it last wherever it
;   stood), and those that push a helper in the order of the helpers'
;   numbers, which the compiler gives them before it reorders the
;   alternatives to tell them apart.
; - A leading reference the compiler substituted by the referenced rule's
;   alternatives is written back where those alternatives, each followed
;   by one same tail, still stand together.
; - A token is written as the terminal it matches: a fixed token as a
;   string, a class as \`[...]\` (a token set the compiler laid over a
;   contested class read back from its name, once its tokens are found
;   to be that class), \`[\\s\\S]\` as \`.\`; a string's and a class's
;   characters as \`render_gbnf\` spells them. A token named for a rule
;   the compiler lifted to it (\`plus ::= "+"\` becomes the token \`#plus\`)
;   is written as that rule, after the others, and referenced by name.
; - GBNF's start rule is \`root\`. A spec whose start rule has another name
;   is written with \`root ::= <start>\` first, as \`render_gbnf\` writes it.
;
; What a rule cannot be read back to is refused with
; TARGET_VALUE_UNREPRESENTABLE, naming the rule: an action other than
; the tree builders every compiled grammar carries (a value annotation's
; builders, a user action, the probe dispatcher's), a condition or a
; counter other than a repeat loop's, an error generator or an alternate
; modifier (\`e\`, \`h\`), a function reference where a rule or a count is
; due, a set of tokens at one place, the form that edits a rule already
; installed (\`{alts, inject}\`), a removal, and a token no GBNF terminal
; matches (the engine's own \`#TX\`, \`#NR\`, \`#ST\` and \`#VL\`, a class whose
; flags change what it matches, a pattern that is neither one class nor
; an escaped literal). A token set whose tokens are not the class its
; name gives, a rule with no alternate to open with, a sequence's step
; with more alternates than a step, and a rule the compiler lifted to a
; token whose name another rule holds are refused too. A spec serialized
; by Go, which writes its rules in name order and its match tokens'
; order as a list of its own (\`options.match.tokenOrder\`), is refused
; when that list holds two tokens or more: the rules' order, which ranks
; the tokens (the order the lexer tries two tokens a place expects), is
; lost. The tree builders and the marks are not written: the compiler
; makes them again from the rules.
; A spec whose start is not the start wrapper every grammar text
; compiles to (one open alternate that matches nothing and pushes a
; rule, closed by the end of the source alone) is refused as well: its
; text would compile back inside such a wrapper, whose close lets the
; end of the source come after what the lexer skips.
;
; A spec compiled from another notation is written as far as GBNF can say
; it: a case-insensitive literal (ABNF's default) as the sequence of
; two-case classes and strings that matches exactly what it matches, as
; \`render_gbnf\` writes it, and an RFC 5234 core rule as a rule of its own.
;
; The whole spec is materialized before a line is written: a rule's
; alternatives are spread over its chain rules and helpers, which the
; spec keeps elsewhere in its \`rule\` object.

; ---- text and vectors

def gbnf-at [v i]
  get-path (as-path [i]) v

def gbnf-num [n]
  scalar-text csv-options n

def gbnf-empty [s]
  match s
    case "" true
    case _ false

def gbnf-full [s]
  match s
    case "" false
    case _ true

; Whether the strings a and b are the same: a string cut by itself is two
; empty strings, and by any other string it is not.
def gbnf-same [a b]
  match b
    case "" (gbnf-empty a)
    case _
      match (split b a)
        case ["" ""] true
        case _ false

def gbnf-not [x]
  match x
    case true false
    case false true

def gbnf-less [a b]
  match (compare a b)
    case :less true
    case _ false

def gbnf-some [v]
  match (count v)
    case 0 false
    case _ true

def gbnf-none [v]
  match (count v)
    case 0 true
    case _ false

def gbnf-rest [v]
  map (fn [i] (gbnf-at v i)) (filter (fn [i] (match i (case 0 false) (case _ true))) (indices v))

def gbnf-take [n v]
  map (fn [i] (gbnf-at v i)) (filter (fn [i] (gbnf-less i n)) (indices v))

def gbnf-drop [n v]
  map (fn [i] (gbnf-at v i)) (filter (fn [i] (gbnf-not (gbnf-less i n))) (indices v))

; Whether s begins with the non-empty p, ends with it; s after its first
; p, before its last.
def gbnf-starts [p s]
  match s
    case "" false
    case _ (gbnf-empty (gbnf-at (split p s) 0))

def gbnf-ends [p s]
  match s
    case "" false
    case _ (gbnf-empty (top (split p s)))

def gbnf-after [p s]
  string-join p (gbnf-rest (split p s))

def gbnf-before [p s]
  string-join p (pop (split p s))

def gbnf-digits [s]
  match s
    case "" false
    case _ (chars-within [[48 57]] s)

; The items of two vectors, and of a vector of vectors, in order: each
; item is named by its place, the places joined as text and read back.
def gbnf-cat [a b]
  gbnf-flat [a b]

def gbnf-flat [vv]
  map
    fn [t]
      let [p (split "." t)]
        get-path (as-path [(number (gbnf-at p 0)) (number (gbnf-at p 1))]) vv
    filter gbnf-full
      split ","
        string-join ","
          map
            fn [j]
              string-join "," (map (fn [i] (string-join "." [(gbnf-num j) (gbnf-num i)])) (indices (gbnf-at vv j)))
            indices vv

; Whether the string s is among the strings of v.
def gbnf-among [s v]
  gbnf-some (filter (fn [x] (gbnf-same x s)) v)

; The items of v whose key is the first of its kind, in order.
def gbnf-unique [keyf v]
  let [ks (map keyf v)]
    let [prev (gbnf-cat ["\\u0000"] (pop (gbnf-cat ks ["\\u0000"])))]
      let [runs (filter (fn [i] (gbnf-not (gbnf-same (gbnf-at ks i) (gbnf-at prev i)))) (indices ks))]
        map
          fn [i] (gbnf-at v i)
          filter
            fn [i]
              gbnf-none (filter (fn [j] (match (gbnf-less j i) (case true (gbnf-same (gbnf-at ks j) (gbnf-at ks i))) (case false false))) runs)
            runs

def gbnf-plus [a b]
  length (string-join "" [(repeat a "x") (repeat b "x")])

def gbnf-ones [n]
  pop (split "x" (repeat n "x"))

def gbnf-even [j]
  gbnf-some (filter (fn [d] (gbnf-ends d (gbnf-num j))) ["0" "2" "4" "6" "8"])

def gbnf-fail [what]
  fail :unrepresentable (string-join "" ["the grammar spec cannot be written as GBNF: " what])

; ---- the spec

def gbnf-rec [v]
  match (kind v)
    case :record v
    case _ (record)

def gbnf-vec [v]
  match (kind v)
    case :vector (as-vector v)
    case _ []

def gbnf-str [v]
  match (kind v)
    case :string v
    case _ ""

def gbnf-context [spec]
  let [o (gbnf-rec (get "options" spec))]
    record
      entry :rules (gbnf-rec (get "rule" spec))
      entry :fixed (gbnf-rec (get-path (as-path ["fixed" "token"]) o))
      entry :match (gbnf-rec (get-path (as-path ["match" "token"]) o))
      entry :sets (gbnf-rec (get "tokenSet" o))
      entry :prov (get-path (as-path ["meta" "provenance"]) spec)
      entry :start (gbnf-str (get-path (as-path ["rule" "start"]) o))

def gbnf-rule [cx name]
  get-path (as-path [name]) (get :rules cx)

def gbnf-has [cx name]
  match (kind (gbnf-rule cx name))
    case :record true
    case _ false

; A rule's alternates in one phase, the falsy placeholders the engine
; skips left out.
def gbnf-open [r]
  filter (fn [alt] (match (kind alt) (case :record true) (case _ false))) (gbnf-vec (get "open" r))

def gbnf-close [r]
  filter (fn [alt] (match (kind alt) (case :record true) (case _ false))) (gbnf-vec (get "close" r))

; The tokens an alternate matches: its \`s\`, a string of token names
; between spaces or a list of them.
def gbnf-s [alt]
  let [s (get "s" alt)]
    match (kind s)
      case :string (filter gbnf-full (split " " s))
      case :vector (map gbnf-str (as-vector s))
      case _ []

def gbnf-b [alt]
  match (kind (get "b" alt))
    case :number (get "b" alt)
    case _ 0

def gbnf-p [alt]
  gbnf-str (get "p" alt)

def gbnf-r [alt]
  gbnf-str (get "r" alt)

def gbnf-a [alt]
  match (kind (get "a" alt))
    case :string (get "a" alt)
    case :missing ""
    case :null ""
    case _ "?"

; Whether the compiler made the rule: provenance names every rule it
; synthesized, and a spec without provenance is read by the names it
; gives them.
def gbnf-made [cx name]
  match (kind (get :prov cx))
    case :record
      match (kind (get-path (as-path [name]) (get :prov cx)))
        case :string true
        case _ false
    case _
      match (gbnf-some (gbnf-rest (split "$" name)))
        case true (gbnf-split-name name)
        case false
          match (gbnf-gen-kind name)
            case ""
              match (gbnf-same name (get :start cx))
                case true (gbnf-wrapper (gbnf-rule cx name))
                case false false
            case k (gbnf-helper-shape cx name k)

; The kind of helper a name gives, as the compiler names the helpers it
; makes, \`_gen<n>_<kind>...\` with the kind a repetition's, an option's or
; a group's (\`_gen3_star_x\`, \`_gen4_group\`), or "" for any other name: a
; rule the author wrote may begin with \`_gen\` too (\`_general\`).
def gbnf-gen-kind [name]
  match (gbnf-starts "_gen" name)
    case false ""
    case true
      let [parts (split "_" (gbnf-after "_gen" name))]
        match (count parts)
          case 1 ""
          case _
            match (match (gbnf-digits (gbnf-at parts 0)) (case true (gbnf-among (gbnf-at parts 1) ["star" "plus" "opt" "rep" "group"])) (case false false))
              case true (gbnf-at parts 1)
              case false ""

; Whether a name is one the compiler gives a rule it splits off another,
; every part after a \`$\` one of its own: a dispatcher's alternative
; (\`$alt<i>\`), a chain's step (\`$step<j>\`), a left-factored tail
; (\`$fact<k>\`), a probe dispatcher (\`$pd<i>\`) and its parts (\`$probe\`,
; \`$with\`, \`$no\`, numbered where the name was taken).
def gbnf-split-name [name]
  gbnf-none (filter (fn [p] (gbnf-not (gbnf-split-part p))) (gbnf-rest (split "$" name)))

def gbnf-split-part [p]
  gbnf-some (filter (fn [k] (gbnf-split-fits k p)) ["alt" "step" "fact" "pd" "probe" "with" "no"])

def gbnf-split-fits [k p]
  match (gbnf-starts k p)
    case false false
    case true
      match (gbnf-after k p)
        case "" (gbnf-among k ["probe" "with" "no"])
        case rest (gbnf-digits rest)

; A rule named as the compiler names a helper, in a spec that names no
; provenance, is the compiler's where it has the shape the compiler gives
; that kind, and the author's otherwise: a repetition's loop has its
; guarded entry (\`{c: {n.rep: 0}, r: <self>}\`); a plus is its item and the
; loop after it; an option one element and the empty alternative; a
; counted repetition copies of one element, and the option or the loop
; after them; a group any alternatives.
def gbnf-helper-shape [cx name k]
  match k
    case "group" true
    case "star" (gbnf-some (filter (fn [alt] (gbnf-loop-entry name alt)) (gbnf-open (gbnf-rule cx name))))
    case _
      let [alts (gbnf-raw-alts cx name)]
        match k
          case "plus" (gbnf-plus-shape alts)
          case "opt" (gbnf-opt-shape alts)
          case _ (gbnf-rep-shape alts)

def gbnf-loop-entry [name alt]
  match (gbnf-same (gbnf-r alt) name)
    case false false
    case true
      let [c (get "c" alt)]
        match (kind c)
          case :record (gbnf-loop-value c "n.rep" [0])
          case _ false

def gbnf-plus-shape [alts]
  match (count alts)
    case 1
      let [seq (gbnf-vec (gbnf-at alts 0))]
        match (count seq)
          case 2 (gbnf-same (gbnf-helper-ref (gbnf-at seq 1)) "star")
          case _ false
    case _ false

def gbnf-opt-shape [alts]
  match (count alts)
    case 2
      let [counts (map count alts)]
        match (gbnf-among "0" (map gbnf-num counts))
          case true (gbnf-among "1" (map gbnf-num counts))
          case false false
    case _ false

def gbnf-rep-shape [alts]
  match (count alts)
    case 1
      let [seq (gbnf-vec (gbnf-at alts 0))]
        match (count seq)
          case 0 true
          case _
            let [lead (match (gbnf-among (gbnf-helper-ref (top seq)) ["star" "opt"]) (case true (pop seq)) (case false seq))]
              let [keys (map gbnf-el-name lead)]
                gbnf-none (filter (fn [key] (match key (case "" true) (case _ (gbnf-not (gbnf-same key (gbnf-at keys 0)))))) keys)
    case _ false

; The kind of helper an element references by name, or "".
def gbnf-helper-ref [el]
  match (get :k el)
    case :ref (gbnf-gen-kind (get :name el))
    case _ ""

; A token or a reference by its name, any other element "".
def gbnf-el-name [el]
  match (get :k el)
    case :tok (string-join "" ["#" (get :name el)])
    case :ref (string-join "" ["@" (get :name el)])
    case _ ""

; The start wrapper the compiler adds, which \`options.rule.start\` names:
; one open alternate that consumes nothing and pushes the grammar's start
; rule, and the end of the source, and nothing else, to close it.
def gbnf-wrapper [r]
  let [o (gbnf-open r)]
    match (count o)
      case 1
        let [a (gbnf-at o 0)]
          match (match (gbnf-some (gbnf-s a)) (case true false) (case false (gbnf-full (gbnf-p a))))
            case false false
            case true
              let [c (gbnf-close r)]
                match (count c)
                  case 0 false
                  case _ (gbnf-none (filter (fn [x] (gbnf-not (gbnf-wrapper-end x))) c))
      case _ false

; A close alternate that matches the end of the source and goes nowhere.
def gbnf-wrapper-end [alt]
  match (gbnf-same (string-join " " (gbnf-s alt)) "#ZZ")
    case false false
    case true (gbnf-empty (gbnf-target alt))

; Every grammar text compiles to a start wrapper around its start rule,
; and the wrapper's close lets the end of the source come after what the
; lexer skips (\`ab \` where the grammar is \`ab\`). So the rule
; \`options.rule.start\` names must be that wrapper: a spec that starts at
; another rule, or at a wrapper without its close, would come back
; accepting what it refuses.
def gbnf-check-start [cx]
  match (gbnf-wrapper (gbnf-rule cx (get :start cx)))
    case true true
    case false (gbnf-fail (string-join "" ["the start rule " (get :start cx) " is not the start wrapper every grammar text compiles to (one open alternate that matches nothing and pushes a rule, closed by the end of the source alone)"]))

; ---- what the spec may hold

; Every alternate is one the compiler's tree-building grammars are made
; of: the tokens it matches and gives back (\`s\`, \`b\`), the rule it pushes
; or replaces itself with (\`p\`, \`r\`), the tree builders (\`a\`, \`k\`), group
; tags, marks and per-rule scratch (\`g\`, \`m\`, \`u\`), and, in a repeat loop
; alone, the loop's guard and counter (\`c\`, \`n\`). Anything more is a
; construct the notation does not write: an error generator (\`e\`), an
; alternate modifier (\`h\`), a function in place of a rule or a count, an
; action other than the tree builders, another condition or counter.
def gbnf-alt-keys ["s" "b" "p" "r" "a" "c" "n" "k" "g" "m" "u"]

def gbnf-key-text [key]
  match key
    case "e" "e (an error generator)"
    case "h" "h (an alternate modifier)"
    case _ key

def gbnf-check-alt [cx name alt]
  let [extra (filter (fn [key] (match (gbnf-among key gbnf-alt-keys) (case true false) (case false (gbnf-given (get key alt))))) (keys alt))]
    match (count extra)
      case 0 (gbnf-check-parts cx name alt)
      case _ (gbnf-fail (string-join "" ["rule " name " has an alternate carrying " (string-join ", " (map gbnf-key-text extra)) ", which is not written"]))

def gbnf-check-parts [cx name alt]
  let [a (gbnf-a alt)]
    match (gbnf-among a ["" "@node$" "@capture$" "@bubble$" "@fold$"])
      case false
        match (gbnf-starts "@probe" (gbnf-action-text alt))
          case true (gbnf-fail (string-join "" ["rule " name " is the probe dispatcher the compiler makes for an optional prefix ([ X D ] Y), which is not read back"]))
          case false (gbnf-fail (string-join "" ["rule " name " carries an action (" (gbnf-action-text alt) "), which is not written"]))
      case true
        let [tokens (gbnf-check-s name (get "s" alt))]
          let [next (count (map (fn [key] (gbnf-check-next name key (get key alt))) ["p" "r"]))]
            let [back (gbnf-check-back name (get "b" alt))]
              gbnf-check-loop cx name alt

; The tokens: a string of names between spaces, or a list of names, one
; place each; a place holding a set of tokens (names between spaces, or a
; list) chooses among them, which the render does not read back.
def gbnf-check-s [name s]
  match (kind s)
    case :missing true
    case :null true
    case :string true
    case :vector
      match (gbnf-none (filter (fn [t] (match (kind t) (case :string (gbnf-some (gbnf-rest (split " " t)))) (case _ true))) (as-vector s)))
        case true true
        case false (gbnf-fail (string-join "" ["rule " name " has an alternate whose s holds, at one place, a set of tokens or something other than a token's name, which is not written"]))
    case _ (gbnf-fail (string-join "" ["rule " name " has an alternate whose s is not tokens, which is not written"]))

; The rule an alternate pushes or replaces itself with: a name, or none;
; a function reference (\`@name\`) chooses at run time and is not written.
def gbnf-check-next [name key v]
  match (kind v)
    case :missing true
    case :null true
    case :boolean (match v (case false true) (case _ (gbnf-fail (string-join "" ["rule " name " has an alternate whose " key " is not a rule, which is not written"]))))
    case :string
      match (gbnf-starts "@" v)
        case true (gbnf-fail (string-join "" ["rule " name " has an alternate whose " key " is the function reference " v ", which is not written"]))
        case false true
    case _ (gbnf-fail (string-join "" ["rule " name " has an alternate whose " key " is not a rule, which is not written"]))

def gbnf-check-back [name v]
  match (kind v)
    case :missing true
    case :null true
    case :number true
    case :boolean (match v (case false true) (case _ (gbnf-fail (string-join "" ["rule " name " has an alternate whose b is not a count, which is not written"]))))
    case _ (gbnf-fail (string-join "" ["rule " name " has an alternate whose b is not a count (" (gbnf-str v) "), which is not written"]))

; A repeat loop's guard (\`c: {n.rep: 0}\`) and counter (\`n: {rep: 0}\` or
; \`{rep: 1}\`), in the loop the compiler makes for a repetition and the
; steps of its item, and nowhere else.
def gbnf-loop-rule [cx name]
  gbnf-same (gbnf-helper-kind cx (gbnf-at (split "$" name) 0)) "star"

def gbnf-check-loop [cx name alt]
  let [c (get "c" alt)]
    let [n (get "n" alt)]
      match (match (gbnf-given c) (case true true) (case false (gbnf-given n)))
        case false true
        case true
          match (gbnf-loop-rule cx name)
            case false (gbnf-fail (string-join "" ["rule " name " carries a condition or a counter outside a repetition's loop, which is not written"]))
            case true
              match (match (gbnf-given c) (case false true) (case true (match (kind c) (case :record (gbnf-loop-value c "n.rep" [0])) (case _ false))))
                case false (gbnf-fail (string-join "" ["rule " name " carries a condition other than its loop's, which is not written"]))
                case true
                  match (match (gbnf-given n) (case false true) (case true (match (kind n) (case :record (gbnf-loop-value n "rep" [0 1])) (case _ false))))
                    case false (gbnf-fail (string-join "" ["rule " name " carries a counter other than its loop's, which is not written"]))
                    case true true

; Whether an alternate gives a field: the engine reads a field that is
; missing, null or false as one it does not give.
def gbnf-given [v]
  match (kind v)
    case :missing false
    case :null false
    case :boolean (match v (case false false) (case _ true))
    case _ true

def gbnf-loop-value [rec key allowed]
  match (keys rec)
    case [only]
      match (gbnf-same only key)
        case false false
        case true
          let [v (get-path (as-path [key]) rec)]
            gbnf-some (filter (fn [x] (match (compare v x) (case :equal true) (case _ false))) allowed)
    case _ false

def gbnf-action-text [alt]
  match (kind (get "a" alt))
    case :string (get "a" alt)
    case :vector (string-join " " (map gbnf-str (as-vector (get "a" alt))))
    case _ "a function"

; A rule's phases: a list of alternates each, or none; the form that edits
; a rule already installed (\`{alts, inject}\`) is not written.
def gbnf-check-phase [name phase v]
  match (kind v)
    case :missing true
    case :null true
    case :vector true
    case :record (gbnf-fail (string-join "" ["rule " name " gives its " phase " alternates as alts and an inject, which edits a rule already installed and is not written"]))
    case _ (gbnf-fail (string-join "" ["rule " name " gives its " phase " alternates in a form that is not a list, which is not written"]))

def gbnf-check-rule [cx name]
  let [r (gbnf-rule cx name)]
    match (kind r)
      case :record
        let [phases (count (map (fn [phase] (gbnf-check-phase name phase (get phase r))) ["open" "close"]))]
          match (count (gbnf-open r))
            case 0 (gbnf-fail (string-join "" ["rule " name " has no alternate to open with, which no grammar text writes"]))
            case _ (count (map (fn [alt] (gbnf-check-alt cx name alt)) (gbnf-cat (gbnf-open r) (gbnf-close r))))
      case :null (gbnf-fail (string-join "" ["rule " name " is removed, which is not written"]))
      case _ (gbnf-fail (string-join "" ["rule " name " is not a rule's alternates, which is not written"]))

; A spec serialized by Go writes its keys in name order and its match
; tokens' order in a list of its own (\`options.match.tokenOrder\`): the
; rules' order, which decides the order the compiler gives the tokens
; again, is lost, and with it which of two tokens that both match wins.
def gbnf-check-order [spec]
  let [order (get-path (as-path ["options" "match" "tokenOrder"]) spec)]
    match (kind order)
      case :vector
        match (gbnf-less (count (as-vector order)) 2)
          case true true
          case false (gbnf-fail "it gives its match tokens' order as a list of its own (tokenOrder, Go's serialization, whose keys are in name order), and the order of the rules, which their precedence follows, is lost")
      case _ true

def gbnf-check [spec cx]
  match (get "clear" spec)
    case true (gbnf-fail "it clears the grammar it is installed on, which is not written")
    case _
      let [order (gbnf-check-order spec)]
        let [start (gbnf-check-start cx)]
          let [rules (count (map (fn [name] (gbnf-check-rule cx name)) (keys (get :rules cx))))]
            gbnf-check-sets cx (gbnf-used cx)

; ---- tokens

def gbnf-bare [t]
  gbnf-after "#" t

def gbnf-lit [text cs]
  record
    entry :k :lit
    entry :text text
    entry :cs cs

def gbnf-class [pat flags]
  record
    entry :k :class
    entry :pat pat
    entry :flags flags

; A pattern's escapes taken back off: an escaped backslash is a pair, any
; other escape one backslash before the character it escapes.
def gbnf-unescape [s]
  string-join "\\\\" (map (fn [piece] (string-join "" (split "\\\\" piece))) (split "\\\\\\\\" s))

; A match token's source, \`@~/^.../flags\`: a class, or a case-folding
; literal.
def gbnf-match-token [t m]
  let [parts (split "/" m)]
    let [flags (top parts)]
      let [src (string-join "/" (pop (gbnf-rest parts)))]
        match (gbnf-starts "^" src)
          case false (gbnf-fail (string-join "" ["the token " t " is the pattern " m ", which no GBNF terminal matches"]))
          case true
            let [body (gbnf-after "^" src)]
              match (gbnf-starts "[" body)
                case true
                  match (gbnf-class-pattern body)
                    case false (gbnf-fail (string-join "" ["the token " t " is the pattern " m ", which is not one class the render reads, and no GBNF terminal matches it"]))
                    case true
                      match (gbnf-flags-fit body flags)
                        case true (gbnf-class body flags)
                        case false (gbnf-fail (string-join "" ["the token " t " is the class " m ", whose flags (" (match flags (case "" "none") (case _ flags)) ") change what it matches, and no GBNF terminal matches it"]))
                case false
                  match flags
                    case "i"
                      match (gbnf-escaped-literal body)
                        case true (gbnf-lit (gbnf-unescape body) false)
                        case false (gbnf-fail (string-join "" ["the token " t " is the pattern " m ", which is not a literal the render reads, and no GBNF terminal matches it"]))
                    case _ (gbnf-fail (string-join "" ["the token " t " is the pattern " m ", which no GBNF terminal matches"]))

; Whether a pattern's body is one class as the compiler writes one:
; \`[\`, an optional \`^\`, members each a \`\\uXXXX\` or \`\\u{X...}\` escape, alone
; or the low end of a range, and \`]\` ending it; or \`[\\s\\S]\`, which
; another notation's \`.\` compiles to.
def gbnf-class-pattern [body]
  match body
    case "[\\\\s\\\\S]" true
    case _
      match (gbnf-ends "]" body)
        case false false
        case true
          let [inner (gbnf-before "]" (gbnf-after "[" body))]
            match (gbnf-some (filter (fn [c] (gbnf-some (gbnf-rest (split c inner)))) ["[" "]"]))
              case true false
              case false
                let [pieces (split "\\\\u" (match (gbnf-starts "^" inner) (case true (gbnf-after "^" inner)) (case false inner)))]
                  match (gbnf-empty (gbnf-at pieces 0))
                    case false false
                    case true
                      let [members (gbnf-rest pieces)]
                        match (count members)
                          case 0 false
                          case _
                            match (gbnf-ends "-" (top members))
                              case true false
                              case false (gbnf-none (filter (fn [m] (gbnf-not (gbnf-member-piece m))) members))

def gbnf-member-piece [piece]
  let [core (match (gbnf-ends "-" piece) (case true (gbnf-before "-" piece)) (case false piece))]
    match (gbnf-starts "{" core)
      case true
        match (gbnf-ends "}" core)
          case false false
          case true
            let [h (gbnf-before "}" (gbnf-after "{" core))]
              match (gbnf-among (gbnf-num (length h)) ["1" "2" "3" "4" "5" "6"])
                case false false
                case true (gbnf-hex-only h)
      case false
        match (length core)
          case 4 (gbnf-hex-only core)
          case _ false

def gbnf-hex-only [h]
  match h
    case "" false
    case _ (chars-within [[48 57] [65 70] [97 102]] h)

; Whether a pattern's body is a literal as the compiler escapes one: every
; character a pattern reads otherwise (\`\\ ^ $ . * + ? ( ) [ ] { } |\`)
; after a backslash, and a backslash before nothing else.
def gbnf-meta-chars ["^" "$" "." "*" "+" "?" "(" ")" "[" "]" "{" "}" "|"]

def gbnf-escaped-literal [body]
  let [rest (gbnf-strip-escapes gbnf-strip-escapes gbnf-meta-chars (string-join "" (split "\\\\\\\\" body)))]
    match (gbnf-some (gbnf-rest (split "\\\\" rest)))
      case true false
      case false (gbnf-none (filter (fn [c] (gbnf-some (gbnf-rest (split c rest)))) gbnf-meta-chars))

def gbnf-strip-escapes [self cs s]
  match (count cs)
    case 0 s
    case _ (self self (pop cs) (string-join "" (split (string-join "" ["\\\\" (top cs)]) s)))

; A token set's class, read back from its name, which the compiler gives
; the class it lays over the atoms (\`rx_\` and the pattern, each character
; that is not a letter or a digit an underscore, in capitals). Each member
; of the pattern is a \`\\u\` escape, \`\\uXXXX\` or \`\\u{X...}\`, alone or the
; low end of a range; the name keeps their digits and order.
def gbnf-hex-lower [h]
  string-join "a" (split "A" (string-join "b" (split "B" (string-join "c" (split "C" (string-join "d" (split "D" (string-join "e" (split "E" (string-join "f" (split "F" h)))))))))))

def gbnf-hex-upper [h]
  string-join "A" (split "a" (string-join "B" (split "b" (string-join "C" (split "c" (string-join "D" (split "d" (string-join "E" (split "e" (string-join "F" (split "f" h)))))))))))

def gbnf-set-member [piece]
  let [parts (split "_" piece)]
    match (gbnf-empty (gbnf-at parts 0))
      case true
        record
          entry :text (string-join "" ["\\\\u{" (gbnf-hex-lower (gbnf-at parts 1)) "}"])
          entry :braced true
          entry :range (match (count parts) (case 4 true) (case _ false))
      case false
        record
          entry :text (string-join "" ["\\\\u" (gbnf-hex-lower (gbnf-at parts 0))])
          entry :braced false
          entry :range (match (count parts) (case 2 true) (case _ false))

def gbnf-set-token [t]
  let [rest (gbnf-after "RX_" (gbnf-bare t))]
    match rest
      case "__S_S" (gbnf-class "[\\\\s\\\\S]" "u")
      case _
        let [pieces (split "_U" rest)]
          let [members (map gbnf-set-member (gbnf-rest pieces))]
            let [negated (gbnf-same (gbnf-at pieces 0) "__")]
              let [body (string-join "" (map (fn [m] (string-join "" [(get :text m) (match (get :range m) (case true "-") (case false ""))])) members))]
                let [pat (string-join "" ["[" (match negated (case true "^") (case false "")) body "]"])]
                  match (gbnf-same (gbnf-class-name pat) (gbnf-bare t))
                    case false (gbnf-fail (string-join "" ["the token set " t " names no class the render can read back"]))
                    case true
                      match negated
                        case true (gbnf-class pat "u")
                        case false (gbnf-class pat (match (gbnf-some (filter (fn [m] (get :braced m)) members)) (case true "u") (case false "")))

; The name the compiler gives a class's token: \`rx_\` and its pattern, every
; character but a letter or a digit an underscore, in capitals, with the
; underscores at the end taken off.
def gbnf-class-name [pat]
  let [u (gbnf-hex-upper (string-join "U" (split "u" (string-join "S" (split "s" pat)))))]
    let [n (string-join "_" (split "[" (string-join "_" (split "]" (string-join "_" (split "^" (string-join "_" (split "-" (string-join "_" (split "\\\\" (string-join "_" (split "{" (string-join "_" (split "}" u))))))))))))))]
      gbnf-trim-end (string-join "" ["RX_" n])

def gbnf-trim-end [s]
  match (gbnf-ends "_" s)
    case true (gbnf-trim-end-once (gbnf-before "_" s))
    case false s

def gbnf-trim-end-once [s]
  match (gbnf-ends "_" s)
    case true (gbnf-before "_" s)
    case false s

; ---- code points and the ranges a class holds

; A code point, from its one to six hexadecimal digits in either case, as
; three numbers, its bytes from the highest, each the place of its two
; digits among \`gbnf-hex-pairs\`: code points are ordered as these are.
def gbnf-cp [h]
  let [x (gbnf-six (gbnf-hex-upper h))]
    let [high (gbnf-pair-start x)]
      let [rest (gbnf-after high x)]
        vector (gbnf-pair-index high) (gbnf-pair-index (gbnf-pair-start rest)) (gbnf-pair-index (gbnf-pair-end rest))

def gbnf-six [h]
  string-join "" [(match (length h) (case 1 "00000") (case 2 "0000") (case 3 "000") (case 4 "00") (case 5 "0") (case _ "")) h]

def gbnf-pair-start [x]
  gbnf-at (filter (fn [p] (gbnf-starts p x)) gbnf-hex-pairs) 0

def gbnf-pair-end [x]
  gbnf-at (filter (fn [p] (gbnf-ends p x)) gbnf-hex-pairs) 0

def gbnf-pair-index [p]
  gbnf-at (filter (fn [i] (gbnf-same (gbnf-at gbnf-hex-pairs i) p)) (indices gbnf-hex-pairs)) 0

def gbnf-cp-order [a b]
  match (compare (gbnf-at a 0) (gbnf-at b 0))
    case :equal
      match (compare (gbnf-at a 1) (gbnf-at b 1))
        case :equal (compare (gbnf-at a 2) (gbnf-at b 2))
        case other other
    case other other

def gbnf-cp-before [a b]
  match (gbnf-cp-order a b)
    case :less true
    case _ false

def gbnf-cp-is [a b]
  match (gbnf-cp-order a b)
    case :equal true
    case _ false

; The code point after one: its low byte one more, carried into the bytes
; above it.
def gbnf-cp-next [c]
  match (gbnf-at c 2)
    case 255
      match (gbnf-at c 1)
        case 255 (vector (gbnf-plus (gbnf-at c 0) 1) 0 0)
        case _ (vector (gbnf-at c 0) (gbnf-plus (gbnf-at c 1) 1) 0)
    case _ (vector (gbnf-at c 0) (gbnf-at c 1) (gbnf-plus (gbnf-at c 2) 1))

def gbnf-cp-max [cps]
  gbnf-at (filter (fn [c] (gbnf-none (filter (fn [d] (gbnf-cp-before c d)) cps))) cps) 0

def gbnf-span [lo hi]
  record
    entry :lo lo
    entry :hi hi

; The members of a class's pattern, read as \`gbnf-class-pattern\` admits
; them: each a range, from its low end's digits to its high end's (a
; character alone is a range of one); \`[\\s\\S]\` every code point. A
; negated class's are the ones it excludes.
def gbnf-class-hex-spans [body]
  match body
    case "[\\\\s\\\\S]" [(gbnf-span "0" "10FFFF")]
    case _
      let [inner (gbnf-before "]" (gbnf-after "[" body))]
        let [pieces (gbnf-rest (split "\\\\u" (match (gbnf-starts "^" inner) (case true (gbnf-after "^" inner)) (case false inner))))]
          let [lows (map (fn [p] (gbnf-ends "-" p)) pieces)]
            let [ends (gbnf-cat [false] lows)]
              map
                fn [i]
                  let [lo (gbnf-piece-hex (gbnf-at pieces i))]
                    match (gbnf-at lows i)
                      case true (gbnf-span lo (gbnf-piece-hex (gbnf-at pieces (gbnf-plus i 1))))
                      case false (gbnf-span lo lo)
                filter (fn [i] (gbnf-not (gbnf-at ends i))) (indices pieces)

def gbnf-piece-hex [p]
  let [core (match (gbnf-ends "-" p) (case true (gbnf-before "-" p)) (case false p))]
    match (gbnf-starts "{" core)
      case true (gbnf-before "}" (gbnf-after "{" core))
      case false core

def gbnf-class-spans [body]
  map (fn [s] (gbnf-span (gbnf-cp (get :lo s)) (gbnf-cp (get :hi s)))) (gbnf-class-hex-spans body)

; Ranges sorted by their low ends and merged where they overlap or meet:
; two lists of ranges hold the same code points when these are the same.
def gbnf-spans-merged [spans]
  let [sorted (gbnf-spans-sorted spans)]
    let [starts (filter (fn [i] (gbnf-none (filter (fn [j] (match (gbnf-less j i) (case true (gbnf-not (gbnf-cp-before (gbnf-cp-next (get :hi (gbnf-at sorted j))) (get :lo (gbnf-at sorted i))))) (case false false))) (indices sorted)))) (indices sorted))]
      map (fn [k] (gbnf-block-span sorted starts k)) (indices starts)

def gbnf-block-span [sorted starts k]
  let [from (gbnf-at starts k)]
    let [members (filter (fn [i] (match (gbnf-less i from) (case true false) (case false (gbnf-before-start starts k i)))) (indices sorted))]
      gbnf-span (get :lo (gbnf-at sorted from)) (gbnf-cp-max (map (fn [i] (get :hi (gbnf-at sorted i))) members))

def gbnf-before-start [starts k i]
  match (gbnf-less (gbnf-plus k 1) (count starts))
    case true (gbnf-less i (gbnf-at starts (gbnf-plus k 1)))
    case false true

def gbnf-spans-sorted [spans]
  let [ranks (map (fn [i] (count (filter (fn [j] (match (gbnf-cp-order (get :lo (gbnf-at spans j)) (get :lo (gbnf-at spans i))) (case :less true) (case :equal (gbnf-less j i)) (case _ false))) (indices spans)))) (indices spans))]
    map (fn [k] (gbnf-at spans (gbnf-at (filter (fn [i] (match (compare (gbnf-at ranks i) k) (case :equal true) (case _ false))) (indices spans)) 0))) (indices spans)

def gbnf-spans-same [a b]
  match (compare (count a) (count b))
    case :equal (gbnf-none (filter (fn [i] (match (gbnf-cp-is (get :lo (gbnf-at a i)) (get :lo (gbnf-at b i))) (case true (gbnf-not (gbnf-cp-is (get :hi (gbnf-at a i)) (get :hi (gbnf-at b i))))) (case false true))) (indices a)))
    case _ false

; Whether two lists of ranges hold every code point between them, each
; once: a negated class's ranges and the ranges it matches.
def gbnf-spans-tile [a b]
  let [all (gbnf-spans-sorted (gbnf-cat (gbnf-spans-merged a) (gbnf-spans-merged b)))]
    match (count all)
      case 0 false
      case _
        match (match (gbnf-cp-is (get :lo (gbnf-at all 0)) (gbnf-cp "0")) (case true (gbnf-cp-is (get :hi (top all)) (gbnf-cp "10FFFF"))) (case false false))
          case false false
          case true
            let [nexts (gbnf-rest all)]
              gbnf-none (filter (fn [i] (gbnf-not (gbnf-cp-is (get :lo (gbnf-at nexts i)) (gbnf-cp-next (get :hi (gbnf-at all i)))))) (indices nexts))

; Whether a class's flags are the ones it is matched with once its text is
; written and compiled back. Every compiler here gives \`u\` to a class that
; is negated, holds a character past U+FFFF or is \`[\\s\\S]\`, and to no
; other. Without \`u\` such a class matches one UTF-16 code unit, half of a
; character past U+FFFF, and with it one code point. A class of other
; characters matches the same either way, unless it holds a surrogate,
; which \`u\` matches only where it stands alone.
def gbnf-flags-fit [body flags]
  match (gbnf-wants-u body)
    case true (gbnf-same flags "u")
    case false
      match (gbnf-holds-surrogate body)
        case true (gbnf-empty flags)
        case false (gbnf-among flags ["" "u"])

def gbnf-wants-u [body]
  match body
    case "[\\\\s\\\\S]" true
    case _
      match (gbnf-starts "[^" body)
        case true true
        case false (gbnf-some (gbnf-rest (split "\\\\u{" body)))

; A class none of whose members is past U+FFFF holds a surrogate where a
; range's low end is not above U+DFFF and its high end not below U+D800.
def gbnf-holds-surrogate [body]
  gbnf-some (filter (fn [s] (match (gbnf-hex-from (get :lo s) ["E" "F"]) (case true false) (case false (gbnf-hex-from (get :hi s) ["D8" "D9" "DA" "DB" "DC" "DD" "DE" "DF" "E" "F"])))) (gbnf-class-hex-spans body))

def gbnf-hex-from [h prefixes]
  let [x (gbnf-hex-upper h)]
    match (length x)
      case 4 (gbnf-some (filter (fn [p] (gbnf-starts p x)) prefixes))
      case _ false

; A token set is the class its name gives when the tokens it lays over
; that class are the class: their ranges, merged, are the class's ranges,
; or, for a negated class, every code point the class does not exclude.
; The compiler lays a contested class over the atoms of a partition, each
; a token of its own, and names the set for the class; the render writes
; the class the name gives, so a set whose tokens match anything else is
; refused.
def gbnf-check-sets [cx used]
  count (map (fn [k] (gbnf-check-set cx (string-join "" ["#" k]))) (filter (fn [k] (match (gbnf-starts "RX_" k) (case true (gbnf-some (gbnf-rest (split (string-join "" [" #" k " "]) used)))) (case false false))) (keys (get :sets cx))))

def gbnf-check-set [cx t]
  let [cls (gbnf-set-token t)]
    let [pat (get :pat cls)]
      let [spans (gbnf-flat (map (fn [m] (gbnf-member-spans cx t m)) (gbnf-vec (get-path (as-path [(gbnf-bare t)]) (get :sets cx)))))]
        let [own (gbnf-class-spans pat)]
          match (match (gbnf-starts "[^" pat) (case true (gbnf-spans-tile own spans)) (case false (gbnf-spans-same (gbnf-spans-merged own) (gbnf-spans-merged spans))))
            case true true
            case false (gbnf-fail (string-join "" ["the token set " t " lays tokens over its class " pat " that match other characters than the class does, and the render writes the class the set's name gives"]))

def gbnf-member-spans [cx t m]
  let [src (match (kind m) (case :string (gbnf-str (get-path (as-path [m]) (get :match cx)))) (case _ ""))]
    let [body (gbnf-after "^" (string-join "/" (pop (gbnf-rest (split "/" src)))))]
      match (match (gbnf-starts "@" src) (case true (match (gbnf-class-pattern body) (case true (match (gbnf-starts "[^" body) (case true false) (case false (gbnf-flags-fit body (top (split "/" src)))))) (case false false))) (case false false))
        case true (gbnf-class-spans body)
        case false (gbnf-fail (string-join "" ["the token set " t " holds " (gbnf-str m) ", which is not one class the render reads"]))

def gbnf-engine-token [t]
  match t
    case "#TX" (record (entry :k :engine) (entry :name "TX"))
    case "#NR" (record (entry :k :engine) (entry :name "NR"))
    case "#ST" (record (entry :k :engine) (entry :name "ST"))
    case "#VL" (record (entry :k :engine) (entry :name "VL"))
    case _ (gbnf-fail (string-join "" ["the token " t " is defined nowhere in the spec"]))

def gbnf-token [cx t]
  let [f (get-path (as-path [t]) (get :fixed cx))]
    match (kind f)
      case :string (gbnf-lit f true)
      case _
        let [m (get-path (as-path [t]) (get :match cx))]
          match (kind m)
            case :string (gbnf-match-token t m)
            case _
              match (kind (get-path (as-path [(gbnf-bare t)]) (get :sets cx)))
                case :vector (gbnf-set-token t)
                case _ (gbnf-engine-token t)

; ---- reading a rule's alternatives

; An element of an alternative as the spec holds it: a token, or a
; reference to a rule (the compiler's helpers among them).
def gbnf-tok-el [t]
  record
    entry :k :tok
    entry :name t

def gbnf-ref-el [n]
  record
    entry :k :ref
    entry :name n

; The tokens an alternate consumes, and the rule it hands over to.
def gbnf-consumed [alt]
  let [s (gbnf-s alt)]
    let [b (gbnf-b alt)]
      gbnf-take (count (filter (fn [j] (gbnf-not (gbnf-less j b))) (indices s))) s

def gbnf-target [alt]
  match (gbnf-p alt)
    case "" (gbnf-r alt)
    case p p

def gbnf-entry-els [alt]
  let [toks (map gbnf-tok-el (gbnf-consumed alt))]
    match (gbnf-target alt)
      case "" toks
      case to (push (gbnf-ref-el to) toks)

def gbnf-entry-key [alt]
  string-join "" [(string-join " " (gbnf-consumed alt)) "|" (gbnf-target alt)]

; A rule whose alternatives are each one segment: its open alternates,
; each read as what it consumes and pushes, a dispatch's lookahead copies
; of one alternative read as one; the empty alternative first, which the
; compiler puts last wherever it stood, so that either place compiles
; back the same. An alternate that consumes nothing and pushes nothing is
; the empty alternative, or a guard that ends it on what may follow; two
; or more bare ones (\`a ::= | \`) are as many empty alternatives.
def gbnf-simple-alts [r]
  let [alts (gbnf-flat (map (fn [alt] (map (fn [i] (gbnf-entry-els alt)) (indices (gbnf-ones (gbnf-copies (gbnf-open r) alt))))) (gbnf-unique gbnf-entry-key (gbnf-open r))))]
    let [bare (count (filter gbnf-bare-empty (gbnf-open r)))]
      let [empties (match (gbnf-some (filter gbnf-none alts)) (case false []) (case true (map (fn [i] []) (indices (gbnf-ones (match (gbnf-less bare 2) (case true 1) (case false bare)))))))]
        gbnf-cat empties (gbnf-number-order (filter gbnf-some alts))

; How many times an alternative stands among the open alternates: the
; lookahead copies a dispatch makes of one alternative consume and push the
; same and look ahead at different tokens, and are one; alternates alike
; in everything are as many alternatives as there are of them.
def gbnf-copies [open alt]
  let [group (filter (fn [a] (gbnf-same (gbnf-entry-key a) (gbnf-entry-key alt))) open)]
    let [counts (map (fn [a] (count (filter (fn [b] (gbnf-same (gbnf-whole-key b) (gbnf-whole-key a))) group))) group)]
      gbnf-at (filter (fn [c] (gbnf-none (filter (fn [d] (gbnf-less c d)) counts))) counts) 0

def gbnf-whole-key [alt]
  string-join "" [(string-join " " (gbnf-s alt)) "|" (gbnf-num (gbnf-b alt)) "|" (gbnf-target alt)]

def gbnf-bare-empty [alt]
  match (gbnf-some (gbnf-s alt))
    case true false
    case false (gbnf-empty (gbnf-target alt))

; The compiler reorders a rule's alternatives to tell them apart (a
; longer lookahead first, a keyword ahead of a class that takes it), and
; numbers the helpers it makes for them, in the order the alternatives
; were written, before it does. So the alternatives that push a helper
; are put back in the order of the helpers' numbers, among their own
; places; the others keep theirs.
def gbnf-alt-number [alt]
  match (count alt)
    case 0 -1
    case _
      let [last (top alt)]
        match (get :k last)
          case :ref
            match (gbnf-starts "_gen" (get :name last))
              case true
                let [d (gbnf-at (split "_" (gbnf-after "_gen" (get :name last))) 0)]
                  match (gbnf-digits d)
                    case true (number d)
                    case false -1
              case false -1
          case _ -1

def gbnf-number-order [alts]
  let [nums (map gbnf-alt-number alts)]
    let [slots (filter (fn [i] (gbnf-not (gbnf-less (gbnf-at nums i) 0))) (indices alts))]
      let [rank (fn [i] (count (filter (fn [j] (match (compare (gbnf-at nums j) (gbnf-at nums i)) (case :less true) (case :equal (gbnf-less j i)) (case _ false))) slots)))]
        let [ranks (map rank slots)]
          map (fn [i] (gbnf-number-at alts nums slots ranks i)) (indices alts)

def gbnf-number-at [alts nums slots ranks i]
  match (gbnf-less (gbnf-at nums i) 0)
    case true (gbnf-at alts i)
    case false
      let [k (count (filter (fn [j] (gbnf-less j i)) slots))]
        gbnf-at alts (gbnf-at slots (gbnf-at (filter (fn [m] (match (compare (gbnf-at ranks m) k) (case :equal true) (case _ false))) (indices slots)) 0))

; The first alternative that is not empty: an option's.
def gbnf-filled [alts]
  gbnf-at (filter gbnf-some alts) 0

; The steps of a chain, each a segment: the tokens its open alternate
; consumes and the rule it pushes, the next step named in its close.
def gbnf-chain-walk [self cx name depth acc]
  let [r (gbnf-chain-step name (gbnf-rule cx name))]
    let [els (gbnf-cat acc (gbnf-entry-els (gbnf-at (gbnf-open r) 0)))]
      match (count (gbnf-close r))
        case 0 els
        case _
          match (gbnf-r (gbnf-at (gbnf-close r) 0))
            case "" els
            case next
              match (gbnf-less (count depth) 200)
                case false (gbnf-fail (string-join "" ["rule " name " is a sequence of more than 200 segments, which the render does not follow"]))
                case true (self self cx next (push 1 depth) els)

def gbnf-chain [cx name]
  gbnf-chain-walk gbnf-chain-walk cx name [] []

; A dispatcher's alternatives: one rule per alternative, \`<rule>$alt<i>\`,
; and the empty one where a number is missing, or last.
def gbnf-head-name [name i]
  string-join "" [name "$alt" (gbnf-num i)]

def gbnf-dispatch-alts [cx name r]
  let [nums (indices (push 0 (gbnf-open r)))]
    let [present (filter (fn [i] (gbnf-has cx (gbnf-head-name name i))) nums)]
      let [last (top present)]
        let [gaps (filter (fn [i] (match (gbnf-less i last) (case true (gbnf-not (gbnf-among (gbnf-num i) (map gbnf-num present)))) (case false false))) nums)]
          let [empty (gbnf-some (filter (fn [alt] (gbnf-empty (gbnf-target alt))) (gbnf-open r)))]
            match (count gaps)
              case 0
                gbnf-cat (map (fn [i] (gbnf-chain cx (gbnf-head-name name i))) present) (match empty (case true [[]]) (case false []))
              case 1
                map
                  fn [i]
                    match (gbnf-has cx (gbnf-head-name name i))
                      case true (gbnf-chain cx (gbnf-head-name name i))
                      case false []
                  filter (fn [i] (gbnf-not (gbnf-less last i))) nums
              case _ (gbnf-fail (string-join "" ["rule " name " dispatches to alternatives the render cannot place"]))

; Whether the rule dispatches to \`$alt\` rules of its own.
def gbnf-dispatches [cx name r]
  gbnf-some (filter (fn [alt] (gbnf-starts (string-join "" [name "$alt"]) (gbnf-target alt))) (gbnf-open r))

; A loop's item: what its continue alternate takes, a token it consumes,
; or the rule its iteration (\`<loop>$alt0\`) pushes.
def gbnf-loop-item [cx name r]
  let [conts (filter (fn [alt] (gbnf-full (gbnf-r alt))) (gbnf-rest (gbnf-open r)))]
    match (count conts)
      case 0 (gbnf-fail (string-join "" ["the repetition " name " repeats nothing"]))
      case _
        let [c (gbnf-at conts 0)]
          match (gbnf-same (gbnf-r c) name)
            case true
              match (gbnf-consumed c)
                case [t] (gbnf-tok-el t)
                case _ (gbnf-fail (string-join "" ["the repetition " name " repeats more than one token"]))
            case false
              match (gbnf-p (gbnf-at (gbnf-open (gbnf-rule cx (gbnf-r c))) 0))
                case "" (gbnf-fail (string-join "" ["the repetition " name " repeats nothing"]))
                case item (gbnf-ref-el item)

; A tail repeat, \`X = prefix [ sep X ]\`, which the compiler makes a loop
; in the rule's close: the separator matched and the rule replaced.
def gbnf-is-tail [name r]
  match (count (gbnf-close r))
    case 2
      let [c (gbnf-at (gbnf-close r) 0)]
        match (gbnf-a c)
          case "@fold$" (gbnf-same (gbnf-r c) name)
          case _ false
    case _ false

; The alternatives of a rule as the spec holds them, each a vector of
; elements; a tail repeat as its prefix and the option around its
; separator and itself.
def gbnf-raw-alts [cx name]
  let [r (gbnf-rule cx name)]
    match (gbnf-is-tail name r)
      case true
        let [prefix (map gbnf-tok-el (gbnf-consumed (gbnf-at (gbnf-open r) 0)))]
          let [sep (map gbnf-tok-el (gbnf-consumed (gbnf-at (gbnf-close r) 0)))]
            vector
              push
                record
                  entry :k :tail
                  entry :seq (push (gbnf-ref-el name) sep)
                prefix
      case false
        match (gbnf-dispatches cx name r)
          case true (gbnf-dispatch-alts cx name r)
          case false
            match (count (gbnf-close r))
              case 0 (gbnf-simple-alts r)
              case _
                match (gbnf-r (gbnf-at (gbnf-close r) 0))
                  case "" (gbnf-simple-alts r)
                  case _ (vector (gbnf-chain cx name))

; A step of a sequence's chain, as the compiler makes one: one open
; alternate, a segment of the sequence, and at most one close alternate,
; which names the next step. A rule that replaces itself in its close and
; has more alternates than that is no chain the render reads back.
def gbnf-chain-step [name r]
  match (match (count (gbnf-open r)) (case 1 (gbnf-less (count (gbnf-close r)) 2)) (case _ false))
    case true r
    case false (gbnf-fail (string-join "" ["rule " name " replaces itself in its close as a sequence's step does, and has more alternates than a step, which is not read back"]))

; ---- the compiler's helpers, read back

; The kind of a helper the compiler named: \`_gen<n>_<kind>...\`.
def gbnf-helper-kind [cx name]
  match (gbnf-made cx name)
    case false ""
    case true
      match (gbnf-starts "_gen" name)
        case true
          let [parts (split "_" (gbnf-after "_gen" name))]
            match (gbnf-digits (gbnf-at parts 0))
              case true (gbnf-at parts 1)
              case false ""
        case false
          match (gbnf-among "fact" (map (fn [p] (gbnf-before-digits p)) (gbnf-rest (split "$" name))))
            case true "fact"
            case false ""

def gbnf-before-digits [p]
  match (gbnf-starts "fact" p)
    case true (match (gbnf-digits (gbnf-after "fact" p)) (case true "fact") (case false p))
    case false p

; An alternative with its factored tails expanded back: one whose last
; element is a left-factored tail (\`<rule>$fact<k>\`) is the prefix before
; it followed by each of the tail's alternatives in turn.
def gbnf-expand [self cx alt]
  match (count alt)
    case 0 [alt]
    case _
      let [last (top alt)]
        match (get :k last)
          case :ref
            match (gbnf-helper-kind cx (get :name last))
              case "fact"
                let [prefix (pop alt)]
                  gbnf-flat (map (fn [tail] (self self cx (gbnf-cat prefix tail))) (gbnf-raw-alts cx (get :name last)))
              case _ [alt]
          case _ [alt]

def gbnf-alts [cx name]
  gbnf-flat (map (fn [alt] (gbnf-split-group cx name alt)) (gbnf-flat (map (fn [alt] (gbnf-expand gbnf-expand cx alt)) (gbnf-raw-alts cx name))))

; The compiler factors a rule's alternatives that are each one group
; (\`( A x ) | ( A y )\`) into the first group, whose sequence then ends in
; the rule's own factored tail (\`<rule>$fact<k>\`); such an alternative is
; read back as the groups it was, one alternative each.
def gbnf-split-group [cx name alt]
  match (count alt)
    case 1
      let [el (gbnf-at alt 0)]
        match (get :k el)
          case :ref
            match (gbnf-helper-kind cx (get :name el))
              case "group"
                let [inner (gbnf-raw-alts cx (get :name el))]
                  match (count inner)
                    case 1
                      let [seq (gbnf-at inner 0)]
                        match (gbnf-owned-fact cx name seq)
                          case true (map (fn [one] [(gbnf-grp-el one)]) (gbnf-expand gbnf-expand cx seq))
                          case false [alt]
                    case _ [alt]
              case _ [alt]
          case _ [alt]
    case _ [alt]

def gbnf-owned-fact [cx name seq]
  match (count seq)
    case 0 false
    case _
      let [last (top seq)]
        match (get :k last)
          case :ref
            match (gbnf-helper-kind cx (get :name last))
              case "fact" (gbnf-starts (string-join "" [name "$fact"]) (get :name last))
              case _ false
          case _ false

; A group read back from a factored alternative: an element of its own,
; written as a group is.
def gbnf-grp-el [seq]
  record
    entry :k :grp
    entry :seq seq

; The parts a repetition counts: the item, how many at least, how many
; at most ("" for no bound). A bounded one ends in nested options, each
; over a group of the item and the next option, the innermost over the
; item alone: \`[ A [ A [ A ] ] ]\`. The compiler numbers them as it makes
; them, the innermost group first, under the number it gave the
; repetition: group n, option n+1 over it, group n+2, ..., so the
; outermost option's number says how deep they go.
def gbnf-gen-number [name]
  number (gbnf-at (split "_" (gbnf-after "_gen" name)) 0)

def gbnf-rep-chain [cx rep opt]
  let [n (gbnf-gen-number rep)]
    let [inner-name (string-join "" ["_gen" (gbnf-num n) "_group"])]
      match (gbnf-has cx inner-name)
        case false (gbnf-fail (string-join "" ["the repetition " rep " is not numbered as the compiler numbers one"]))
        case true
          let [inner (gbnf-raw-alts cx inner-name)]
            match (count (gbnf-at inner 0))
              case 1
                let [span (count (filter (fn [j] (gbnf-not (gbnf-less j n))) (indices (gbnf-ones (gbnf-plus (gbnf-gen-number opt) 1)))))]
                  record
                    entry :item (gbnf-at (gbnf-at inner 0) 0)
                    entry :depth (count (filter gbnf-even (indices (gbnf-ones span))))
              case _ (gbnf-fail (string-join "" ["the repetition " rep " is not numbered as the compiler numbers one"]))

def gbnf-rep-parts [cx name]
  let [seq (gbnf-at (gbnf-raw-alts cx name) 0)]
    let [last (match (count seq) (case 0 (gbnf-fail (string-join "" ["the repetition " name " repeats its item no times, and the spec does not keep the item"]))) (case _ (top seq)))]
      let [lead (pop seq)]
        match (gbnf-helper-kind cx (gbnf-str (get :name last)))
          case "star"
            record
              entry :item (gbnf-loop-item cx (get :name last) (gbnf-rule cx (get :name last)))
              entry :min (count lead)
              entry :max ""
          case "opt"
            let [chain (gbnf-rep-chain cx name (get :name last))]
              record
                entry :item (get :item chain)
                entry :min (count lead)
                entry :max (gbnf-num (gbnf-plus (count lead) (get :depth chain)))
          case _
            record
              entry :item (gbnf-at seq 0)
              entry :min (count seq)
              entry :max (gbnf-num (count seq))

; An element's structure as one string, a helper by what it compiles (a
; counted repetition by its item and counts, not by the nested options
; it compiles to, which are as deep as its count).
def gbnf-key [self cx el]
  match (get :k el)
    case :tok (get :name el)
    case :tail "[tail]"
    case :grp (string-join "" ["group(" (gbnf-key-seq self cx (get :seq el)) ")"])
    case :ref
      let [name (get :name el)]
        match (gbnf-helper-kind cx name)
          case "" (string-join "" ["@" name])
          case "star" (string-join "" ["*(" (self self cx (gbnf-loop-item cx name (gbnf-rule cx name))) ")"])
          case "rep"
            let [parts (gbnf-rep-parts cx name)]
              string-join "" ["rep(" (gbnf-num (get :min parts)) "," (get :max parts) "," (self self cx (get :item parts)) ")"]
          case kind (string-join "" [kind "(" (string-join "|" (map (fn [seq] (gbnf-key-seq self cx seq)) (gbnf-alts cx name))) ")"])

def gbnf-key-seq [self cx seq]
  string-join " " (map (fn [e] (self self cx e)) seq)

def gbnf-seq-keys [cx seq]
  map (fn [el] (gbnf-key gbnf-key cx el)) seq

; ---- characters

; A literal's characters as their code points, which a notation writes
; where a quoted string cannot hold a character, and the names the
; compiler derives from a literal's text.

; The ASCII characters, each with its two hexadecimal digits.
def gbnf-ascii [["\\u0000" "00"] ["\\u0001" "01"] ["\\u0002" "02"] ["\\u0003" "03"] ["\\u0004" "04"] ["\\u0005" "05"] ["\\u0006" "06"] ["\\u0007" "07"] ["\\b" "08"] ["\\t" "09"] ["\\n" "0A"] ["\\u000b" "0B"] ["\\f" "0C"] ["\\r" "0D"] ["\\u000e" "0E"] ["\\u000f" "0F"] ["\\u0010" "10"] ["\\u0011" "11"] ["\\u0012" "12"] ["\\u0013" "13"] ["\\u0014" "14"] ["\\u0015" "15"] ["\\u0016" "16"] ["\\u0017" "17"] ["\\u0018" "18"] ["\\u0019" "19"] ["\\u001a" "1A"] ["\\u001b" "1B"] ["\\u001c" "1C"] ["\\u001d" "1D"] ["\\u001e" "1E"] ["\\u001f" "1F"] [" " "20"] ["!" "21"] ["\\"" "22"] ["#" "23"] ["$" "24"] ["%" "25"] ["&" "26"] ["'" "27"] ["(" "28"] [")" "29"] ["*" "2A"] ["+" "2B"] ["," "2C"] ["-" "2D"] ["." "2E"] ["/" "2F"] ["0" "30"] ["1" "31"] ["2" "32"] ["3" "33"] ["4" "34"] ["5" "35"] ["6" "36"] ["7" "37"] ["8" "38"] ["9" "39"] [":" "3A"] [";" "3B"] ["<" "3C"] ["=" "3D"] [">" "3E"] ["?" "3F"] ["@" "40"] ["A" "41"] ["B" "42"] ["C" "43"] ["D" "44"] ["E" "45"] ["F" "46"] ["G" "47"] ["H" "48"] ["I" "49"] ["J" "4A"] ["K" "4B"] ["L" "4C"] ["M" "4D"] ["N" "4E"] ["O" "4F"] ["P" "50"] ["Q" "51"] ["R" "52"] ["S" "53"] ["T" "54"] ["U" "55"] ["V" "56"] ["W" "57"] ["X" "58"] ["Y" "59"] ["Z" "5A"] ["[" "5B"] ["\\\\" "5C"] ["]" "5D"] ["^" "5E"] ["_" "5F"] ["\`" "60"] ["a" "61"] ["b" "62"] ["c" "63"] ["d" "64"] ["e" "65"] ["f" "66"] ["g" "67"] ["h" "68"] ["i" "69"] ["j" "6A"] ["k" "6B"] ["l" "6C"] ["m" "6D"] ["n" "6E"] ["o" "6F"] ["p" "70"] ["q" "71"] ["r" "72"] ["s" "73"] ["t" "74"] ["u" "75"] ["v" "76"] ["w" "77"] ["x" "78"] ["y" "79"] ["z" "7A"] ["{" "7B"] ["|" "7C"] ["}" "7D"] ["~" "7E"] ["\\u007f" "7F"]]

; A piece of a literal's text: a run of its characters (\`:raw\`), or one
; character as its code point (\`:cp\`). A run is cut at each place it
; holds a character, which is put back as its code point between the
; pieces, and the empty runs are left out.
def gbnf-raw-seg [s]
  record
    entry :raw s

def gbnf-cp-seg [h]
  record
    entry :cp h

def gbnf-cut-seg [c h seg]
  match (kind (get :raw seg))
    case :string
      let [pieces (split c (get :raw seg))]
        gbnf-flat (map (fn [i] (match i (case 0 [(gbnf-raw-seg (gbnf-at pieces 0))]) (case _ [(gbnf-cp-seg h) (gbnf-raw-seg (gbnf-at pieces i))]))) (indices pieces))
    case _ [seg]

def gbnf-kept-seg [seg]
  match (get :raw seg)
    case "" false
    case _ true

; The sixteen hexadecimal digits, and the 256 pairs of them.
def gbnf-hex-digits ["0" "1" "2" "3" "4" "5" "6" "7" "8" "9" "A" "B" "C" "D" "E" "F"]

def gbnf-hex-pairs
  gbnf-flat (map (fn [a] (map (fn [b] (string-join "" [a b])) gbnf-hex-digits)) gbnf-hex-digits)

; ---- token names

; The name the compiler derives for a literal's token: the text in
; capitals, each character that is not a letter or a digit an underscore,
; the underscores at either end taken off, \`T\` when nothing is left, and a
; number after it when the name is taken. A token with any other name is a
; rule the compiler lifted to a token.
def gbnf-upper-pairs [["a" "A"] ["b" "B"] ["c" "C"] ["d" "D"] ["e" "E"] ["f" "F"] ["g" "G"] ["h" "H"] ["i" "I"] ["j" "J"] ["k" "K"] ["l" "L"] ["m" "M"] ["n" "N"] ["o" "O"] ["p" "P"] ["q" "Q"] ["r" "R"] ["s" "S"] ["t" "T"] ["u" "U"] ["v" "V"] ["w" "W"] ["x" "X"] ["y" "Y"] ["z" "Z"]]

def gbnf-swap-walk [self pairs s]
  match (count pairs)
    case 0 s
    case _
      let [pair (top pairs)]
        self self (pop pairs) (string-join (gbnf-at pair 1) (split (gbnf-at pair 0) s))

def gbnf-word-chars [[48 57] [65 90] [97 122]]

def gbnf-base-name [text]
  let [up (gbnf-swap-walk gbnf-swap-walk gbnf-upper-pairs text)]
    let [others (filter (fn [ch] (gbnf-not (chars-within gbnf-word-chars (gbnf-at ch 0)))) gbnf-ascii)]
      let [under (gbnf-swap-walk gbnf-swap-walk (map (fn [ch] [(gbnf-at ch 0) "_"]) others) up)]
        let [pieces (split "_" under)]
          let [full (filter (fn [i] (gbnf-full (gbnf-at pieces i))) (indices pieces))]
            match (count full)
              case 0 "T"
              case _
                let [lo (gbnf-at full 0)]
                  let [hi (top full)]
                    string-join "_" (map (fn [i] (gbnf-at pieces i)) (filter (fn [i] (match (gbnf-less i lo) (case true false) (case false (gbnf-not (gbnf-less hi i))))) (indices pieces)))

def gbnf-derived [bare text]
  match (chars-within [[48 57] [65 90] [95 95]] bare)
    case false false
    case true
      match (chars-within [[0 127]] text)
        case false true
        case true
          let [base (gbnf-base-name text)]
            match (gbnf-same bare base)
              case true true
              case false
                match (gbnf-starts base bare)
                  case true (gbnf-digits (gbnf-after base bare))
                  case false false

; Every token name the alternates match, one string.
def gbnf-used [cx]
  let [rules (get :rules cx)]
    string-join ""
      vector
        " "
        string-join " "
          map
            fn [name]
              let [r (get-path (as-path [name]) rules)]
                string-join " " (gbnf-flat (map gbnf-s (gbnf-cat (gbnf-open r) (gbnf-close r))))
            keys rules
        " "

; ---- references written back

; The compiler substitutes a reference that leads an alternative by the
; referenced rule's alternatives, each followed by what followed the
; reference (\`a = b "x"\`, \`b = "y" / "z"\` compiles \`a\` as \`"y" "x" / "z"
; "x"\`), and compiles the reference back to the same alternatives. So
; where a run of a rule's alternatives is another rule's alternatives,
; each followed by one same tail, the reference is written back in their
; place. A candidate is a rule the written file can name, with its
; alternatives' keys; a rule that is one reference (\`a = b\`) is none,
; since the compiler leaves such a rule a reference rather than
; substituting it.
def gbnf-candidates [cx names]
  filter
    fn [c] (gbnf-not (gbnf-alias-keys (get :keys c)))
    map (fn [n] (record (entry :name n) (entry :keys (map (fn [seq] (gbnf-seq-keys cx seq)) (gbnf-alts cx n))))) names

def gbnf-alias-keys [ks]
  match (count ks)
    case 1
      match (count (gbnf-at ks 0))
        case 1 (gbnf-starts "@" (gbnf-at (gbnf-at ks 0) 0))
        case _ false
    case _ false

; Whether alternatives are one alternative of one reference to a rule:
; a rule the compiler leaves as it is.
def gbnf-alias [cx alts]
  match (count alts)
    case 1
      let [seq (gbnf-at alts 0)]
        match (count seq)
          case 1
            match (get :k (gbnf-at seq 0))
              case :ref (gbnf-empty (gbnf-helper-kind cx (get :name (gbnf-at seq 0))))
              case _ false
          case _ false
    case _ false

; Whether the alternative's keys begin with the candidate alternative's,
; and what follows them ("\\u0000" where they do not).
def gbnf-prefix-tail [ks cs]
  match (gbnf-less (count ks) (count cs))
    case true "\\u0000"
    case false
      match (gbnf-same (string-join "\\u0001" (gbnf-take (count cs) ks)) (string-join "\\u0001" cs))
        case true (string-join "\\u0001" (gbnf-drop (count cs) ks))
        case false "\\u0000"

; Whether the candidate's alternatives, each followed by one same tail,
; are the alternatives from position i on.
def gbnf-cand-matches [c ka i]
  let [k (count (get :keys c))]
    match (gbnf-less (count ka) (gbnf-plus i k))
      case true false
      case false
        let [first (gbnf-prefix-tail (gbnf-at ka i) (gbnf-at (get :keys c) 0))]
          match first
            case "\\u0000" false
            case _ (gbnf-none (filter (fn [j] (gbnf-not (gbnf-same (gbnf-prefix-tail (gbnf-at ka (gbnf-plus i j)) (gbnf-at (get :keys c) j)) first))) (indices (get :keys c))))

; The candidate, other than the rule itself, whose alternatives stand at
; position i: where several do, the one with the most alternatives, and
; among those the one the spec defines first. The spec cannot tell \`a = b
; ";"\` with \`b = c "("\` from \`a = c "(" ";"\`, nor a reference from two
; rules that begin alike by chance; a grammar written from the top down
; defines the rule an author named before the ones it is made of.
def gbnf-cand-at [cands ka i self]
  let [hits (filter (fn [c] (match (gbnf-same (get :name c) self) (case true false) (case false (gbnf-cand-matches c ka i)))) cands)]
    let [most (filter (fn [c] (gbnf-none (filter (fn [d] (gbnf-less (count (get :keys c)) (count (get :keys d)))) hits))) hits)]
      match (count most)
        case 0 null
        case _ (gbnf-at most 0)

; A rule's alternatives with the references written back: each run a
; candidate covers, from the first position one stands at that no other
; run covers, written as the reference and the tail; the alternatives
; as they are where no run is found, and where writing one back would
; leave the rule one reference, which the compiler would not substitute.
def gbnf-unsub [cx cands self alts]
  match (count cands)
    case 0 alts
    case _
      let [ka (map (fn [seq] (gbnf-seq-keys cx seq)) alts)]
        let [best (map (fn [i] (gbnf-cand-at cands ka i self)) (indices alts))]
          let [covers (fn [j i] (match (kind (gbnf-at best j)) (case :record (match (gbnf-less j i) (case true (gbnf-less i (gbnf-plus j (count (get :keys (gbnf-at best j)))))) (case false false))) (case _ false)))]
            let [accepted (map (fn [i] (match (kind (gbnf-at best i)) (case :record (gbnf-none (filter (fn [j] (covers j i)) (indices alts)))) (case _ false))) (indices alts))]
              let [out (gbnf-flat (map (fn [i] (gbnf-unsub-at cx alts best accepted covers i)) (indices alts)))]
                match (gbnf-alias cx out)
                  case true alts
                  case false out

def gbnf-unsub-at [cx alts best accepted covers i]
  match (gbnf-at accepted i)
    case true
      let [c (gbnf-at best i)]
        vector (gbnf-cat [(gbnf-ref-el (get :name c))] (gbnf-drop (count (gbnf-at (get :keys c) 0)) (gbnf-at alts i)))
    case false
      match (gbnf-some (filter (fn [j] (match (gbnf-at accepted j) (case true (covers j i)) (case false false))) (indices alts)))
        case true []
        case false [(gbnf-at alts i)]

; ---- GBNF's terminals

; The control characters' two-digit escapes, the JSON form's lower-case
; digits beside GBNF's capitals.
def gbnf-hex-pairs-lower
  map gbnf-hex-lower gbnf-hex-pairs

; A piece of a string's JSON form that holds no escaped backslash, with
; JSON's escapes that GBNF spells otherwise rewritten: \`\\b\` and \`\\f\` as
; \`\\x08\` and \`\\x0C\`, and \`\\u00XX\`, the other control characters, as
; \`\\xXX\`.
def gbnf-from-json-piece [piece]
  let [bf (string-join "\\\\x0C" (split "\\\\f" (string-join "\\\\x08" (split "\\\\b" piece))))]
    let [parts (split "\\\\u00" bf)]
      string-join ""
        gbnf-cat
          [(gbnf-at parts 0)]
          map (fn [p] (gbnf-control-escape p)) (gbnf-rest parts)

def gbnf-control-escape [p]
  let [found (filter (fn [h] (gbnf-starts h p)) gbnf-hex-pairs-lower)]
    match (count found)
      case 0 (string-join "" ["\\\\u00" p])
      case _ (string-join "" ["\\\\x" (gbnf-hex-upper (gbnf-at found 0)) (gbnf-after (gbnf-at found 0) p)])

; A literal as a GBNF string: the quote and the backslash escaped, a line
; feed, a carriage return and a tab by their letters, the other control
; characters (C0, DEL and C1) as \`\\xXX\`, everything else as it is.
def gbnf-string [text]
  let [q (quoted text)]
    let [inner (gbnf-before "\\"" (gbnf-after "\\"" q))]
      string-join "" ["\\"" (gbnf-c1 (string-join "\\\\\\\\" (map gbnf-from-json-piece (split "\\\\\\\\" inner)))) "\\""]

; DEL and the C1 controls, which JSON leaves as they are, as \`\\xXX\`.
def gbnf-c1-chars [127 128 129 130 131 132 133 134 135 136 137 138 139 140 141 142 143 144 145 146 147 148 149 150 151 152 153 154 155 156 157 158 159]

def gbnf-c1 [s]
  match (chars-within [[0 126] [160 1114111]] s)
    case true s
    case false (gbnf-c1-walk gbnf-c1-walk gbnf-c1-chars s)

def gbnf-c1-walk [self codes s]
  match (count codes)
    case 0 s
    case _
      let [h (gbnf-hex-upper (gbnf-at gbnf-hex-pairs-lower (top codes)))]
        self self (pop codes) (string-join (string-join "" ["\\\\x" h]) (split (unquoted (string-join "" ["\\"\\\\u00" (gbnf-hex-lower h) "\\""])) s))

; A case-insensitive literal (ABNF's default) as GBNF, which has none:
; each ASCII letter a class of its two cases, each run of other characters
; a string, which matches exactly what the literal matches. A letter past
; ASCII has no one right expansion, and is refused.
def gbnf-fold-cut [self pairs segs]
  match (count pairs)
    case 0 segs
    case _
      let [pair (top pairs)]
        let [mark (string-join "" ["[" (gbnf-at pair 0) (gbnf-at pair 1) "]"])]
          self self (pop pairs) (gbnf-fold-split (gbnf-at pair 1) mark (gbnf-fold-split (gbnf-at pair 0) mark segs))

def gbnf-fold-split [c mark segs]
  filter gbnf-kept-seg (gbnf-flat (map (fn [seg] (gbnf-cut-seg c mark seg)) segs))

; The characters whose cases a case-insensitive literal's pattern does not
; fold, which a string matches exactly: ASCII, whose letters are written
; as the classes of their two cases, and the characters past U+FFFF but
; those of the scripts that have cases (Deseret, Osage, Vithkuqi, Old
; Hungarian, Garay, Warang Citi, Medefaidrin, Adlam). A character of the
; Basic Multilingual Plane past ASCII may have cases, and is refused.
def gbnf-caseless [[0 127] [65536 66559] [66640 66735] [66816 66927] [67008 68735] [68864 68927] [69008 71839] [71936 93759] [93856 125183] [125280 1114111]]

def gbnf-folded [text]
  match (chars-within gbnf-caseless text)
    case false (gbnf-fail (string-join "" ["the case-insensitive literal " (quoted text) " holds a character past ASCII that may have cases, which GBNF cannot spell"]))
    case true
      map
        fn [seg]
          match (kind (get :raw seg))
            case :string (gbnf-string (get :raw seg))
            case _ (get :cp seg)
        gbnf-fold-cut gbnf-fold-cut gbnf-upper-pairs [(gbnf-raw-seg text)]

; A literal's GBNF items: one string where the match is exact, a
; sequence where it folds case.
def gbnf-lit-items [text cs]
  match cs
    case true [(gbnf-string text)]
    case false (gbnf-folded text)

; A class's member, \`\\uXXXX\` or \`\\u{X...}\`, as \`render_gbnf\` writes it: a
; printable character as itself, the five that mean something inside a
; class escaped, a control character as \`\\xXX\`, a line feed, a carriage
; return and a tab by their letters, a surrogate by its escape, and a
; character past U+FFFF as \`\\UXXXXXXXX\`.
def gbnf-surrogate [h]
  gbnf-some (filter (fn [p] (gbnf-starts p h)) ["d8" "d9" "da" "db" "dc" "dd" "de" "df"])

def gbnf-member [e]
  let [u (gbnf-after "\\\\u" e)]
    match (gbnf-starts "{" u)
      case true
        let [hex (gbnf-hex-lower (gbnf-before "}" (gbnf-after "{" u)))]
          match (gbnf-less 4 (length hex))
            case true (string-join "" ["\\\\U" (match (length hex) (case 5 "000") (case _ "00")) (gbnf-hex-upper hex)])
            case false (gbnf-bmp-member (string-join "" [(match (length hex) (case 1 "000") (case 2 "00") (case 3 "0") (case _ "")) hex]))
      case false (gbnf-bmp-member (gbnf-hex-lower u))

def gbnf-bmp-member [h]
  match h
    case "005d" "\\\\]"
    case "005b" "\\\\["
    case "005c" "\\\\\\\\"
    case "002d" "\\\\u002D"
    case "005e" "\\\\u005E"
    case "000a" "\\\\n"
    case "000d" "\\\\r"
    case "0009" "\\\\t"
    case _
      match (gbnf-surrogate h)
        case true (string-join "" ["\\\\u" (gbnf-hex-upper h)])
        case false
          let [c (unquoted (string-join "" ["\\"\\\\u" h "\\""]))]
            match (chars-within [[0 31] [127 159]] c)
              case true (string-join "" ["\\\\x" (gbnf-hex-upper (gbnf-after "00" h))])
              case false c

; A class's pattern as GBNF: \`.\` for \`[\\s\\S]\`, and otherwise its members
; and ranges, each member as \`gbnf-member\` writes it.
def gbnf-class-text [pat]
  match pat
    case "[\\\\s\\\\S]" "."
    case _
      let [body (gbnf-before "]" (gbnf-after "[" pat))]
        let [negated (gbnf-starts "^" body)]
          let [members (gbnf-rest (split "\\\\u" (match negated (case true (gbnf-after "^" body)) (case false body))))]
            string-join ""
              vector
                "["
                match negated
                  case true "^"
                  case false ""
                string-join "" (map (fn [m] (match (gbnf-ends "-" m) (case true (string-join "" [(gbnf-member (string-join "" ["\\\\u" (gbnf-before "-" m)])) "-"])) (case false (gbnf-member (string-join "" ["\\\\u" m]))))) members)
                "]"

; ---- GBNF's elements

; A rule name GBNF can spell: letters, digits, \`_\` and \`-\`.
def gbnf-legal-name [name]
  match name
    case "" false
    case _ (chars-within [[45 45] [48 57] [65 90] [95 95] [97 122]] name)

def gbnf-ref-text [name]
  match (gbnf-legal-name name)
    case true name
    case false (gbnf-fail (string-join "" ["the rule " (quoted name) " has a name GBNF cannot spell"]))

; Whether a token is a rule the compiler lifted: a literal's token whose
; name is not the one the literal gives it, or that nothing references,
; and whose name GBNF can spell.
def gbnf-lifted [cx used t]
  let [info (gbnf-token cx t)]
    match (get :k info)
      case :lit
        match (gbnf-legal-name (gbnf-bare t))
          case false false
          case true
            match (gbnf-derived (gbnf-bare t) (get :text info))
              case false true
              case true (gbnf-not (gbnf-some (gbnf-rest (split (string-join "" [" " t " "]) used))))
      case _ false

; A token's GBNF items: the rule it was lifted from, a literal's string or
; folded sequence, a class.
def gbnf-token-items [cx lifted t]
  match (gbnf-among t lifted)
    case true [(gbnf-bare t)]
    case false
      let [info (gbnf-token cx t)]
        match (get :k info)
          case :lit (gbnf-lit-items (get :text info) (get :cs info))
          case :class [(gbnf-class-text (get :pat info))]
          case :engine (gbnf-fail (string-join "" ["the token " t " is the engine's own " (get :name info) ", which no GBNF terminal matches"]))

def gbnf-rep-text [self cx lifted name]
  let [parts (gbnf-rep-parts cx name)]
    let [min (gbnf-num (get :min parts))]
      let [count-text (match (get :max parts) (case "" (string-join "" ["{" min ",}"])) (case max (match (gbnf-same min max) (case true (string-join "" ["{" min "}"])) (case false (string-join "" ["{" min "," max "}"])))))]
        string-join "" [(self self cx lifted :atom (get :item parts)) count-text]

; The element a postfix applies to: a terminal, a rule, a group, or
; another postfixed element, which GBNF chains (\`x*?\`); a folded literal
; of more than one item is put in parentheses, as \`render_gbnf\` puts it.
def gbnf-atom-text [self cx lifted el]
  match (get :k el)
    case :tok
      let [items (gbnf-token-items cx lifted (get :name el))]
        match (count items)
          case 1 (gbnf-at items 0)
          case _ (string-join "" ["(" (string-join " " items) ")"])
    case _ (self self cx lifted :el el)

def gbnf-el-text [self cx lifted el]
  match (get :k el)
    case :tok (string-join " " (gbnf-token-items cx lifted (get :name el)))
    case :tail (string-join "" ["(" (self self cx lifted :alts [(get :seq el)]) ")?"])
    case :grp (string-join "" ["(" (self self cx lifted :alts [(get :seq el)]) ")"])
    case :ref
      let [name (get :name el)]
        match (gbnf-helper-kind cx name)
          case "" (gbnf-ref-text name)
          case "star" (string-join "" [(self self cx lifted :atom (gbnf-loop-item cx name (gbnf-rule cx name))) "*"])
          case "plus"
            let [seq (gbnf-at (gbnf-alts cx name) 0)]
              string-join "" [(self self cx lifted :atom (gbnf-at seq 0)) "+"]
          case "opt"
            let [inner (gbnf-at (gbnf-filled (gbnf-alts cx name)) 0)]
              string-join "" [(self self cx lifted :atom inner) "?"]
          case "rep" (gbnf-rep-text self cx lifted name)
          case "group" (string-join "" ["(" (self self cx lifted :alts (gbnf-alts cx name)) ")"])
          case kind (gbnf-fail (string-join "" ["the rule " name " is a helper of a kind the render does not read (" kind ")"]))

def gbnf-seq-text [self cx lifted seq]
  string-join " " (map (fn [el] (self self cx lifted :el el)) seq)

; The text of a rule's or a group's alternatives (\`:alts\`, GBNF's \`|\`
; between them, nothing for an empty one), of an element (\`:el\`) and of
; the element a postfix applies to (\`:atom\`): the one function the render
; recurses through, as \`self\`, a helper's alternatives a level deeper.
def gbnf-text [self cx lifted mode x]
  match mode
    case :alts (string-join " | " (map (fn [seq] (gbnf-seq-text self cx lifted seq)) x))
    case :el (gbnf-el-text self cx lifted x)
    case :atom (gbnf-atom-text self cx lifted x)

; ---- the file

def gbnf-production [cx cands lifted name]
  string-join "" [(gbnf-ref-text name) " ::= " (gbnf-text gbnf-text cx lifted :alts (gbnf-unsub cx cands name (gbnf-alts cx name)))]

def gbnf-lifted-production [cx t]
  let [info (gbnf-token cx t)]
    string-join "" [(gbnf-ref-text (gbnf-bare t)) " ::= " (string-join " " (gbnf-lit-items (get :text info) (get :cs info)))]

; The grammar's start rule: the one the start wrapper pushes, or the rule
; \`options.rule.start\` names where it is no wrapper.
def gbnf-start-rule [cx]
  let [r (gbnf-rule cx (get :start cx))]
    match (gbnf-wrapper r)
      case true (gbnf-p (gbnf-at (gbnf-open r) 0))
      case false (get :start cx)

; A rule the compiler lifted to a token is written under the token's name,
; which no rule of the spec may hold already, nor the \`root\` a written
; start line takes: two productions of one name are one rule.
def gbnf-check-lifted [cx taken lifted]
  map
    fn [t]
      match (match (gbnf-has cx (gbnf-bare t)) (case true true) (case false (gbnf-among (gbnf-bare t) taken)))
        case true (gbnf-fail (string-join "" ["the token " t " is written as a rule named " (gbnf-bare t) ", the name of another rule the text holds"]))
        case false t
    lifted

; GBNF's start rule is \`root\`: a spec whose start rule has another name
; is written with \`root ::= <start>\` first, and one that has a \`root\` that
; is not its start rule cannot be written.
def gbnf-root-lines [names start]
  match start
    case "root" []
    case _
      match (gbnf-among "root" names)
        case true (gbnf-fail (string-join "" ["the start rule is " start ", and GBNF starts from the rule named root, which is another"]))
        case false [(string-join "" ["root ::= " (gbnf-ref-text start)])]

def gbnf-file [spec]
  let [cx (gbnf-context spec)]
    let [checked (gbnf-check spec cx)]
      let [names (filter (fn [n] (gbnf-not (gbnf-made cx n))) (keys (get :rules cx)))]
        let [start (gbnf-start-rule cx)]
          let [used (gbnf-used cx)]
            let [tokens (gbnf-cat (keys (get :fixed cx)) (keys (get :match cx)))]
              let [lifted (gbnf-check-lifted cx (match start (case "root" []) (case _ ["root"])) (filter (fn [t] (gbnf-lifted cx used t)) tokens))]
                let [cands (gbnf-candidates cx names)]
                  string-join ""
                    vector
                      string-join "\\n" (gbnf-flat [(gbnf-root-lines names start) (map (fn [n] (gbnf-production cx cands lifted n)) names) (map (fn [t] (gbnf-lifted-production cx t)) lifted)])
                      "\\n"

def gbnf-render [input]
  concat-map gbnf-file (select root input)
`})});function zc(){return Yc}});var Zi=xe(ue=>{"use strict";Object.defineProperty(ue,"__esModule",{value:!0});ue.translate=ue.GbnfRenderError=ue.GbnfCompileError=ue.GbnfParseError=ue.gbnfRules=ue.eliminateLeftRecursion=ue.emitGrammarSpec=ue.renderGbnf=ue.parseGbnf=ue.toSpec=ue.gbnfConvert=ue.gbnf=ue.VERSION=void 0;var Ve=Di();Object.defineProperty(ue,"gbnfConvert",{enumerable:!0,get:function(){return Ve.gbnf}});Object.defineProperty(ue,"parseGbnf",{enumerable:!0,get:function(){return Ve.parseGbnf}});Object.defineProperty(ue,"emitGrammarSpec",{enumerable:!0,get:function(){return Ve.emitGrammarSpec}});Object.defineProperty(ue,"eliminateLeftRecursion",{enumerable:!0,get:function(){return Ve.eliminateLeftRecursion}});Object.defineProperty(ue,"gbnfRules",{enumerable:!0,get:function(){return Ve.gbnfRules}});Object.defineProperty(ue,"GbnfParseError",{enumerable:!0,get:function(){return Ve.GbnfParseError}});Object.defineProperty(ue,"GbnfCompileError",{enumerable:!0,get:function(){return Ve.GbnfCompileError}});var Wi=zi();Object.defineProperty(ue,"renderGbnf",{enumerable:!0,get:function(){return Wi.renderGbnf}});Object.defineProperty(ue,"GbnfRenderError",{enumerable:!0,get:function(){return Wi.GbnfRenderError}});var Vc=function(t,n){let s=((r,i)=>{let a=(0,Ve.gbnf)(r,i);return t.grammar(a),a});s.toSpec=(r,i)=>(0,Ve.gbnf)(r,i),t.gbnf=s};ue.gbnf=Vc;var Wc=Ve.gbnf;ue.toSpec=Wc;var Zc=Vi();Object.defineProperty(ue,"translate",{enumerable:!0,get:function(){return Zc.translate}});var Jc="0.1.19";ue.VERSION=Jc});var Qc=xe(()=>{var Ji=Hs(_t()),Qi=Hs(Zi());globalThis.tabnasGbnfDemo={Tabnas:Ji.Tabnas,gbnf:Qi.gbnf}});Qc();})();
