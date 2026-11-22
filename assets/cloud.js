// The browser keeps its private device token. Approval links contain only its hash.
const StepCloud = (() => {
  const api='https://step-tracker-api.2319bli.workers.dev';
  const tokenKey='steptracker.cloud.device.v1';
  const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  let paired=false;

  function token(create=false){
    try {
      let value=localStorage.getItem(tokenKey);
      if (!/^[a-f0-9]{64}$/.test(value??'')) {
        if (!create) return null;
        value=hex(crypto.getRandomValues(new Uint8Array(32)));
        localStorage.setItem(tokenKey,value);
      }
      return value;
    } catch {
      if(create)throw Error('Allow this site to store data in your browser to connect this device.');
      return null;
    }
  }
  async function call(path,{auth=false,method='GET',body}={}){
    const headers={};
    if(auth){
      const secret=token();if(!secret)throw Error('Connect this browser first.');
      headers.Authorization='Bearer '+secret;
    }
    if(body!==undefined)headers['Content-Type']='application/json';
    let result;
    try{result=await fetch(api+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(12000)});}
    catch{throw Error('Cloudflare could not be reached. Check your connection and try again.');}
    const data=await result.json().catch(()=>({}));
    if(!result.ok){if(result.status===401)paired=false;throw Error(data.error||'Cloudflare could not complete the request.');}
    return data;
  }
  async function connected(){
    paired=!!(token() && (await call('/device',{auth:true})).paired);return paired;
  }
  async function id(){
    const secret=token(true);
    return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret))));
  }
  return { id, connected, get paired(){return paired;}, read:()=>call('/steps'),
    save:(date,steps,previous)=>call('/steps',{auth:true,method:'PUT',body:{date,steps,previous}}),
    approve:id=>call('/devices',{auth:true,method:'POST',body:{id}})
  };
})();
