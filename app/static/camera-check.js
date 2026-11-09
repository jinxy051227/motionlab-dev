const $=id=>document.getElementById(id);
let stream=null;
const names={NotAllowedError:'浏览器没有获得摄像头权限。请检查地址栏左侧的摄像头权限设置。',NotFoundError:'没有找到可用摄像头。',NotReadableError:'摄像头可能已被Zoom、FaceTime等应用占用。',OverconstrainedError:'请求的视频配置不受支持，请尝试默认配置。',SecurityError:'当前网页来源不允许摄像头，请访问localhost或HTTPS。'};
const status=t=>$('status').textContent=t;
function stop(){stream?.getTracks().forEach(t=>t.stop());stream=null;$('preview').pause();$('preview').srcObject=null;status('摄像头已经关闭。');}
$('stop').onclick=stop;
$('start').onclick=async()=>{
 $('start').disabled=true;stop();
 status(`页面：${location.href}\n安全来源：${window.isSecureContext?'是':'否'}\n浏览器摄像头接口：${navigator.mediaDevices?.getUserMedia?'存在':'不存在'}\n正在请求权限…`);
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('浏览器没有getUserMedia；使用Chrome访问127.0.0.1或HTTPS。');
  stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
  $('preview').srcObject=stream;
  await $('preview').play();
  const track=stream.getVideoTracks()[0];const settings=track?.getSettings?.()||{};
  status(`摄像头成功开启！\n设备：${track?.label||'未知'}\n画面分辨率：${settings.width||'未知'} × ${settings.height||'未知'}\n\n如果3D版依然无法识别手部，问题更可能出在MediaPipe模型加载或3D版初始化。`);
 }catch(e){status(`摄像头开启失败：${e?.name||'Error'}\n${names[e?.name]||e?.message||'未知错误'}\n\n建议：使用Chrome访问 http://127.0.0.1:8000/camera-check ，并检查macOS 系统设置 → 隐私与安全性 → 摄像头。`);}
 finally{$('start').disabled=false;}
};
window.addEventListener('pagehide',()=>stream?.getTracks().forEach(t=>t.stop()));
