import{m as k}from"./B8M5arCw.js";import{f as _,l as h,q as l,o as r,c as m,a as c,t as C,g as d,m as $,u as w,b as A,F as B,j as N,n as u,k as j}from"./hs9a8vFw.js";import{_ as q,a as D}from"./CTMFEjIq.js";import{u as F,q as I}from"./kO7ZMzSD.js";import{u as V}from"./DNi4Enkr.js";import"./CSySbreO.js";import"./DDPKj4Qn.js";import"./DlAUqK2U.js";import"./C4Zbi334.js";import"./BFMJfJAU.js";import"./TX1W-hxV.js";const E={class:"container mx-auto"},S={class:"p-6 my-4 mx-2 rounded-md bg-gray-200 dark:bg-slate-900"},z={class:"text-black dark:text-white font-semibold leading-tight text-xl md:text-2xl"},H=_({__name:"topic",setup(y){const s=h(),i=l(()=>{const n=s.params.category||"";let a="";return Array.isArray(n)?a=n.at(0)||"":a=n,k(a)});return(n,a)=>(r(),m("div",E,[c("div",S,[c("h1",z," #"+C(d(i)),1)])]))}}),L={class:"container max-w-5xl mx-auto text-zinc-600 px-4"},R={class:"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"},X=_({__name:"[category]",async setup(y){let s,i;const n=h(),a=l(()=>{const o=n.params.category||"";let t="";return Array.isArray(o)?t=o.at(0)||"":t=o,t}),{data:g}=([s,i]=$(()=>F(`category-data-${a.value}`,()=>I("/blogs").where({tags:{$contains:a.value}}).find())),s=await s,i(),s),f=l(()=>{var o;return(o=g.value)==null?void 0:o.map(t=>({path:t._path,title:t.title||"no-title available",description:t.description||"no-description available",image:t.image||"/blogs-img/blog.jpg",alt:t.alt||"no alter data available",ogImage:t.ogImage||"/blogs-img/blog.jpg",date:t.date||"not-date-available",tags:t.tags||[],published:t.published||!1}))});return w({title:a.value,meta:[{name:"description",content:`You will find all the ${a.value} related post here`}]}),V(),(o,t)=>{var p;const b=H,x=q,v=D;return r(),m("main",L,[A(b),c("div",R,[(r(!0),m(B,null,N(d(f),e=>(r(),u(x,{key:e.title,path:e.path,title:e.title,date:e.date,description:e.description,image:e.image,alt:e.alt,"og-image":e.ogImage,tags:e.tags,published:e.published},null,8,["path","title","date","description","image","alt","og-image","tags","published"]))),128)),((p=d(g))==null?void 0:p.length)===0?(r(),u(v,{key:0})):j("",!0)])])}}});export{X as default};