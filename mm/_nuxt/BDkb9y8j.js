import{_ as D}from"./CSySbreO.js";import{_ as I,a as q}from"./DDPKj4Qn.js";import{f as b,r as L,o as i,c as m,a as n,t as x,b as _,F as v,j as $,g as r,k as C,l as j,m as N,n as T,w as z,d as S,p as V,q as H,u as O,s as A,v as f}from"./hs9a8vFw.js";import F from"./skG8-fZZ.js";import{_ as R}from"./BFMJfJAU.js";import{q as B,u as E}from"./kO7ZMzSD.js";import"./DlAUqK2U.js";import"./DbAvAuZQ.js";import"./C-v3KzvZ.js";import"./CxYJgpPD.js";import"./TX1W-hxV.js";const M={class:"text-xl dark:text-zinc-300 md:text-3xl lg:text-4xl m-7 font-bold text-center"},G={class:"text-xs sm:text-sm my-3 max-w-xl mx-auto text-center text-zinc-600 dark:text-zinc-400"},J={class:"flex w-full justify-center text-xs md:text-base my-8"},K={class:"md:flex text-black dark:text-zinc-300 content-center gap-8 text-xs sm:text-sm"},P={class:"flex items-center font-semibold"},Q={class:"flex items-center gap-2 flex-wrap my-5"},U=b({__name:"Header",props:{title:{default:"no-title"},image:{default:"#"},alt:{default:"no-img"},description:{default:"no description"},date:{default:"no-date"},tags:{default:()=>[]}},setup(y){const o=L(!1);return(a,s)=>{const e=D,g=I,t=q;return i(),m(v,null,[n("header",null,[n("h1",M,x(a.title||""),1),_(e,{src:a.image||"",alt:a.alt||"",width:"600",class:"m-auto rounded-2xl shadow-lg h-32 md:h-72 w-4/6 md:w-4/5 content-center object-contain",onClick:s[0]||(s[0]=l=>o.value=!0)},null,8,["src","alt"]),n("p",G,x(a.description),1),n("div",J,[n("div",K,[n("div",P,[_(g),n("p",null,x(a.date||""),1)]),n("div",Q,[_(t),(i(!0),m(v,null,$(a.tags,l=>(i(),m("span",{key:l,class:"bg-gray-200 dark:bg-slate-900 rounded-md px-2 py-1 font-semibold"},x(l),1))),128))])])])]),r(o)?(i(),m("div",{key:0,class:"fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50",onClick:s[1]||(s[1]=l=>o.value=!1)},[_(e,{src:a.image||"",alt:a.alt||"",class:"rounded-2xl shadow-lg max-h-screen max-w-screen object-contain"},null,8,["src","alt"])])):C("",!0)],64)}}}),W={class:"lg:col-span-3 sticky top-28 h-96 hidden lg:block justify-self-end"},X={class:"border dark:border-gray-800 p-3 rounded-md min-w-[200px] dark:bg-slate-900"},Y=b({__name:"Toc",async setup(y){var t,l;let o,a;const{path:s}=j(),e=([o,a]=N(()=>B(s).findOne()),o=await o,a(),o),g=((l=(t=e==null?void 0:e.body)==null?void 0:t.toc)==null?void 0:l.links)||[];return(p,d)=>{const u=R;return i(),m("div",W,[n("div",X,[d[0]||(d[0]=n("h1",{class:"text-sm font-bold mb-3 border-b dark:border-gray-800 pb-2"},"Table Of Content",-1)),(i(!0),m(v,null,$(r(g),c=>(i(),T(u,{key:c.id,to:`#${c.id}`,class:"block text-xs mb-3 hover:underline"},{default:z(()=>[S(x(c.text),1)]),_:2},1032,["to"]))),128))])])}}}),Z={class:"px-6 container max-w-5xl mx-auto sm:grid grid-cols-12 gap-x-12"},tt={class:"col-span-12 lg:col-span-9"},et={class:"prose prose-pre:max-w-xs sm:prose-pre:max-w-full prose-sm sm:prose-base md:prose-lg prose-h1:no-underline max-w-5xl mx-auto prose-zinc dark:prose-invert prose-img:rounded-lg"},ut=b({__name:"[blog]",async setup(y){let o,a;const{path:s}=j(),{data:e,error:g}=([o,a]=N(()=>E(`blog-post-${s}`,()=>B(s).findOne())),o=await o,a(),o);g.value&&V("/404");const t=H(()=>{var l,p,d,u,c,h,w,k;return{title:((l=e.value)==null?void 0:l.title)||"no-title available",description:((p=e.value)==null?void 0:p.description)||"no-description available",image:((d=e.value)==null?void 0:d.image)||"/not-found.jpg",alt:((u=e.value)==null?void 0:u.alt)||"no alter data available",ogImage:((c=e.value)==null?void 0:c.ogImage)||"/not-found.jpg",date:((h=e.value)==null?void 0:h.date)||"not-date-available",tags:((w=e.value)==null?void 0:w.tags)||[],published:((k=e.value)==null?void 0:k.published)||!1}});return O({title:t.value.title||"",meta:[{name:"description",content:t.value.description},{name:"description",content:t.value.description},{property:"og:site_name",content:A.homeTitle},{hid:"og:type",property:"og:type",content:"website"},{property:"og:url",content:`${f.mySite}/${s}`},{property:"og:title",content:t.value.title},{property:"og:description",content:t.value.description},{property:"og:image",content:t.value.ogImage||t.value.image},{name:"twitter:site",content:"@qdnvubp"},{name:"twitter:card",content:"summary_large_image"},{name:"twitter:url",content:`${f.mySite}/${s}`},{name:"twitter:title",content:t.value.title},{name:"twitter:description",content:t.value.description},{name:"twitter:image",content:t.value.ogImage||t.value.image}],link:[{rel:"canonical",href:`${f.mySite}/${s}`}]}),(l,p)=>{const d=U,u=F,c=Y;return i(),m("div",Z,[n("div",tt,[_(d,{title:r(t).title,image:r(t).image,alt:r(t).alt,date:r(t).date,description:r(t).description,tags:r(t).tags},null,8,["title","image","alt","date","description","tags"]),n("div",et,[r(e)?(i(),T(u,{key:0,value:r(e)},{empty:z(()=>p[0]||(p[0]=[n("p",null,"No content found.",-1)])),_:1},8,["value"])):C("",!0)])]),_(c)])}}});export{ut as default};