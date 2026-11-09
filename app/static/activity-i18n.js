/** Localized activity-history messages for the 2D and 3D labs.
 * Store the original event message and localize only at render time, so changing
 * language also updates historical entries without modifying the experiment.
 * Known events use complete message templates, not tr()'s fragment substitution.
 */
import {getLanguage,tr,scenarioLabel} from './i18n.js';
import {LESSON_PLANS} from './lesson-flow.js';
import {SCENARIOS} from './experiment-engine.js';

const choose=(language,ja,en)=>language==='ja'?ja:en;

const STEPS = {
 '检查实验安全':['実験前の安全確認','Check laboratory safety'],
 '第一次加入碱液':['塩基性溶液を最初に加える','Add base solution: first dose'],
 '接近理论等量点':['理論当量点に近づける','Approach theoretical equivalence'],
 '观察微观离子':['イオンをミクロで観察','Observe ions microscopically'],
 '混合碳酸钠溶液':['炭酸ナトリウム水溶液を混合','Mix sodium carbonate solution'],
 '查看沉淀微观示意':['沈殿のミクロモデルを観察','Inspect microscopic precipitation'],
 '加入碳酸氢钠':['炭酸水素ナトリウムを加える','Add sodium bicarbonate'],
 '观察微观变化':['ミクロの変化を観察','Observe microscopic changes'],
 '加入第一份食盐':['最初の食塩を加える','Add the first salt portion'],
 '继续投料直到模拟饱和':['模擬飽和まで食塩を追加','Continue adding salt toward simulated saturation'],
 '观察溶质和未溶固体':['溶質と未溶解固体を観察','Inspect dissolved and undissolved solids'],
 '演示加热与蒸发':['加熱と蒸発を実演','Demonstrate heating and evaporation'],
 '观察水的状态变化':['水の状態変化を観察','Observe changes of state of water'],
};
const STEP_DETAILS = {
 '先确认安全与起始溶液':['安全と初期溶液を確認','Verify safety and initial contents'],
 '观察酸性溶液逐渐接近中性':['酸性溶液が中性に近づく様子を観察','Observe the solution approach neutrality'],
 '理论等量点为10.00mL，酚酞终点并不完全相同':['理論当量点は10.00 mL。フェノールフタレインの終点とは必ずしも一致しません','Theoretical equivalence is 10.00 mL; the phenolphthalein endpoint may differ'],
 '观看微观图与实时pH并生成学习记录':['ミクロ画像とリアルタイムpHを確認し、学習記録を作成','View the microscopic diagram and live pH, and create a learning record'],
 '准备两种溶液':['2種類の溶液を準備','Prepare both solutions'],
 '观察CaCO₃沉淀与离子变化':['CaCO₃沈殿とイオンの変化を観察','Observe CaCO₃ precipitation and ion changes'],
 '区分沉淀与溶液中的旁观离子':['沈殿と溶液中の傍観イオンを区別','Distinguish the precipitate from spectator ions'],
 '确认起始溶液':['初期溶液を確認','Check the starting solution'],
 '观察气体发生':['気体の発生を観察','Observe gas formation'],
 '查看反应物消耗和生成物':['反応物の消費と生成物を確認','Inspect reactant consumption and products'],
 '准备溶剂':['溶媒を準備','Prepare the solvent'],
 '观察溶解后的离子':['溶解したイオンを観察','Observe dissolved ions'],
 '区分溶解与饱和':['溶解と飽和を区別','Distinguish dissolution and saturation'],
 '理解饱和溶液':['飽和溶液を理解','Understand saturated solutions'],
 '检查水量与虚拟热源':['水量と仮想熱源を確認','Check water volume and simulated heat source'],
 '本模型加热时间被加速，不代表真实实验耗时':['加熱時間は加速しており、実際の実験時間を表しません','Simulated heating is accelerated; it does not represent real laboratory timing'],
 '区分状态变化与化学反应':['状態変化と化学反応を区別','Distinguish physical changes of state from chemical reactions'],
};

// Full, authored translations: fragments such as "实验步骤" must never be
// replaced inside a longer sentence, which produced mixed-language logs.
const EXACT = [
 ['3D实验台已重置。玻璃器材受重力和碰撞影响。','3D実験台をリセットしました。ガラス器具には重力と衝突が作用します。','3D lab reset. Glassware is affected by gravity and collisions.'],
 ['自动教学演示：模拟安全确认（不代表检测到真正佩戴护目镜）。','自動デモ：保護メガネの着用を模擬的に確認しました。実物の着用は検出していません。','Auto demo: simulated goggles check; actual safety goggles were not detected.'],
 ['自动观察微观视角：粒子来自当前化学状态。','自動ミクロ観察：粒子表示は現在の化学状態を反映しています。','Automatic microscopic observation: particles reflect the current chemical state.'],
 ['自动演示完成。此结果不能用来评定独立实操能力。','自動デモが完了しました。この結果は独立した実技能力の評価には使えません。','Auto demo completed. This result cannot be used to assess independent practical skills.'],
 ['瓶口已自动对准。开始逐步倾倒，浓度/液量与反应同步更新。','瓶口の位置合わせが完了しました。少しずつ注ぎ、濃度・液量・反応を同期更新します。','Bottle spout aligned. Pouring gradually; concentration, volume and reaction update together.'],
 ['切换到教学任务。','学習モードに切り替えました。','Switched to guided lesson.'],
 ['切换到自由探索。','自由実験モードに切り替えました。','Switched to free exploration.'],
 ['已进入固定平视：3D器材不会变成2D贴图，镜头不再乱转。','固定正面ビューになりました。器具は3Dのままで、カメラは固定されます。','Fixed-front view enabled. Equipment remains 3D and the camera stays fixed.'],
 ['已进入自由3D：可以旋转视角及WASD漫游。','自由3Dビューになりました。カメラ回転とWASD移動が可能です。','Free 3D view enabled. Camera rotation and WASD navigation are available.'],
 ['试管对准孔位并插入试管架，底部已进入架内，而非悬浮在表面。','試験管を試験管立ての穴に挿入しました。底部は立ての内側に入っています。','Test tube inserted into the rack opening; its base is inside the rack, not floating above it.'],
 ['酒精灯倾倒：灯帽脱离灯口，受重力掉落。','アルコールランプが倒れ、ふたが外れて落下しました。','Alcohol lamp tipped over; its cap detached and fell.'],
 ['已取下酒精灯灯帽并轻放在桌面。','アルコールランプのふたを外し、机に置きました。','Alcohol lamp cap removed and placed safely on the desk.'],
 ['试管容量20mL：超过部分会溢出。','試験管の容量は20 mLです。超過分はあふれます。','Test tube capacity is 20 mL; excess liquid will overflow.'],
 ['试管倾斜：液体开始洒出。','試験管が傾き、液体がこぼれ始めました。','Test tube tilted; liquid started to spill.'],
 ['酒精灯倾倒：灯帽脱落，模拟燃料泄漏。现实中应远离火源并按安全规范处置。','アルコールランプが倒れ、ふたが外れ、模擬燃料が漏れました。実際は火元から離れ、安全手順に従ってください。','Alcohol lamp tipped over; the cap detached and simulated fuel spilled. In reality, keep away from flames and follow safety procedures.'],
 ['WASD漫游已开启：WASD/方向键平移、Q/E升降、Shift加速、左键拖动转头。','WASD移動を有効にしました。WASD/矢印キーで移動、Q/Eで上下、Shiftで加速、左ドラッグで視点変更。','WASD navigation enabled: move with WASD/arrows, ascend/descend with Q/E, hold Shift to speed up, drag to look around.'],
 ['镜头模式：左键旋转、右键平移、滚轮缩放。','カメラモード：左ドラッグで回転、右ドラッグで平行移動、ホイールでズーム。','Camera mode: left-drag to orbit, right-drag to pan, wheel to zoom.'],
 ['器材模式：拖拽器材；在空白处仍可旋转镜头。','器具モード：器具をドラッグ。空白部分ではカメラを回転できます。','Equipment mode: drag equipment; drag empty space to orbit the camera.'],
 ['未确认护目镜就开始加液。','保護メガネを確認せずに液体を加えようとしました。','Attempted to add liquid without confirming safety goggles.'],
 ['找不到完整试管，请添加试管。','破損していない試験管がありません。試験管を追加してください。','No intact test tube found. Add a test tube.'],
 ['请先模拟确认佩戴护目镜。','まず保護メガネの着用を模擬的に確認してください。','Confirm simulated safety goggles first.'],
 ['酒精灯已点燃。','アルコールランプに点火しました。','Alcohol lamp lit.'],
 ['请先取下灯帽，并确认当前处于允许点火的状态。','まずふたを外し、点火可能な状態であることを確認してください。','Remove the lamp cap and confirm the lamp is safe to light.'],
 ['本演示请先确认佩戴护目镜。','このデモの前に保護メガネの着用を確認してください。','Confirm safety goggles before this demo.'],
 ['请先选择接收器。','受け容器を選んでください。','Select a receiving vessel first.'],
 ['目标容器没有实验液体。','対象の容器に実験用の液体がありません。','The target vessel contains no experimental liquid.'],
 ['摄像头和手部识别模型已启动。画面仅在本机处理。','カメラと手の認識モデルを起動しました。映像は端末内で処理します。','Camera and hand-tracking model started. Video is processed on this device only.'],
 ['摄像头已开启，但手部识别模型失败。请查看摄像头状态，并尝试重试。','カメラは起動しましたが、手の認識に失敗しました。状態を確認して再試行してください。','Camera started, but hand tracking failed. Check camera status and retry.'],
 ['请先开启摄像头','まずカメラを起動してください。','Start the camera first.'],
 ['MediaPipe手部模型重新连接成功。','MediaPipeの手認識モデルに再接続しました。','MediaPipe hand-tracking model reconnected successfully.'],
 ['试剂瓶中液体不足。','試薬瓶の残量が不足しています。','Not enough liquid remains in the reagent bottle.'],
 ['自动演示正在缓慢推进简化加热模型，请观察温度与水量。','自動デモで簡略化した加熱モデルを進めています。温度と水量を観察してください。','Auto demo is running the simplified heating model. Watch temperature and water volume.'],
 ['当前没有进行中的辅助倒液。','現在、補助注液は実行されていません。','No assisted pour is currently in progress.'],
 ['请先选中试管、烧杯或锥形瓶。','試験管、ビーカー、または三角フラスコを選んでください。','Select a test tube, beaker or Erlenmeyer flask first.'],
 ['请先在器材模式中选中一个器材，再聚焦视角。','器具モードで器具を選んでから、視点を合わせてください。','Select equipment in equipment mode before focusing the camera.'],
 ['请先开启摄像头。','まずカメラを起動してください。','Start the camera first.'],
 ['已清除手部二维平滑和握持状态；不需要调整手与摄像头之间的深度。','2D手ぶれ補正と把持状態をリセットしました。手とカメラの距離を調整する必要はありません。','2D hand smoothing and grip state reset; no hand-to-camera depth adjustment is required.'],
 ['找不到完整试管与试管架，无法完成归位。','破損していない試験管と試験管立てが見つかりません。','Cannot return the tube: no intact test tube and rack were found.'],
 ['已确认佩戴护目镜（模拟）。','保護メガネの着用を確認しました（模擬）。','Safety goggles confirmed (simulated).'],
 ['取消了护目镜确认。','保護メガネの確認を解除しました。','Safety goggles confirmation removed.'],
 ['已重置当前容器实验状态。','現在の容器の実験状態をリセットしました。','Current vessel experiment state reset.'],
 ['灯帽第一次盖上，火已熄灭。下一步：取下灯帽。','最初のふたをかぶせ、火を消しました。次にふたを外してください。','First cap applied; flame extinguished. Next, remove the cap.'],
 ['已待模拟冷却后再次盖好灯帽。完成正确流程。','模擬冷却後、ふたを再びかぶせました。手順完了。','Cap replaced after simulated cooling. Procedure completed.'],
 ['请等待模拟冷却结束，再盖上灯帽。','模擬冷却が終わってからふたをかぶせてください。','Wait for simulated cooling before replacing the cap.'],
 ['当前步骤不允许盖帽。先点燃或先取下第一次盖的帽。','現在の手順ではふたをかぶせられません。点火するか、最初にかぶせたふたを外してください。','Capping is not allowed at this step. Light the lamp or remove the first cap.'],
 ['已安全取下灯帽并放在台面上，可以在做好防护后点燃。','ふたを安全に外して机に置きました。安全を確認してから点火できます。','Lamp cap removed safely and placed on the desk. The lamp can be lit after safety checks.'],
 ['第一次盖帽后已取下。待模拟冷却再盖第二次（非真实冷却时间）。','最初の消火後にふたを外しました。模擬冷却の後でもう一度ふたをかぶせてください。','Cap removed after initial extinguishing. Replace it after simulated cooling (not real cooling time).'],
 ['当前无需取下灯帽。','現在、ふたを外す必要はありません。','The cap does not need to be removed now.'],
 ['自动演示：模拟确认护目镜（未检测真实护目镜）。','自動デモ：保護メガネの着用を模擬確認しました（実物は検出していません）。','Auto demo: simulated goggles confirmation (actual goggles were not detected).'],
 ['自动演示：开始加速加热。','自動デモ：加速加熱を開始しました。','Auto demo: accelerated heating started.'],
 ['自动演示：正在观察实时微观示意。','自動デモ：リアルタイムのミクロモデルを観察中です。','Auto demo: observing the live microscopic model.'],
 ['自动演示已结束，生成了学习记录。','自動デモが完了し、学習記録を作成しました。','Auto demo finished and a learning record was generated.'],
 ['系统辅助将瓶口对准接收容器（对位辅助不计入实际操作成绩）','システムが瓶口を受け容器に合わせました（補助操作は実技評価対象外）。','The system aligned the spout with the receiving vessel (assistance does not count toward hands-on assessment).'],
 ['摄像头明确松开试剂瓶','カメラ操作で試薬瓶を離しました。','Released the reagent bottle through camera control.'],
 ['安全提醒：没有确认护目镜','安全上の注意：保護メガネを未確認。','Safety warning: goggles not confirmed.'],
 ['请先选择试剂瓶。','試薬瓶を選んでください。','Select a reagent bottle first.'],
 ['目标必须是试管、烧杯或锥形瓶。','対象は試験管、ビーカー、または三角フラスコでなければなりません。','The destination must be a test tube, beaker or Erlenmeyer flask.'],
 ['加入体积必须大于0。','添加量は0より大きい必要があります。','The volume to add must be greater than zero.'],
 ['试剂瓶已空。','試薬瓶は空です。','The reagent bottle is empty.'],
 ['目标容器已满。','受け容器が満杯です。','The receiving vessel is full.'],
 ['已放下试剂瓶。尚未对准实验容器。','試薬瓶を置きました。実験容器とはまだ位置が合っていません。','Reagent bottle put down; it is not yet aligned with the receiving vessel.'],
 ['确认握拳动作：已从瓶身抓住试剂瓶','握り動作を確認し、瓶をつかみました。','Power grip confirmed; reagent bottle grabbed.'],
 ['放大观察：当前容器离子和分子示意随实验状态更新。','拡大観察：現在の容器のイオン・分子モデルが実験状態に応じて更新されます。','Magnified view: ion and molecule diagrams update with the vessel state.'],
 ['开始简化的加热模拟。','簡略化した加熱シミュレーションを開始しました。','Simplified heating simulation started.'],
 ['停止加热。','加熱を停止しました。','Heating stopped.'],
 ['加热模拟快进15秒。','加熱シミュレーションを15秒早送りしました。','Fast-forwarded simulated heating by 15 seconds.'],
];
const exact=new Map(EXACT.map(([source,ja,en])=>[source,{ja,en}]));
const template=(s,lang)=>exact.get(s)?.[lang];

function name(s){return tr(s);}
function lessonTerm(s,lang){
 const pair=STEPS[s]||STEP_DETAILS[s];
 return pair?pair[lang==='ja'?0:1]:name(s);
}
function scenarioTitle(source){
 for(const [id,scenario] of Object.entries(SCENARIOS))if(source===scenario.title)return scenarioLabel(id);
 return name(source);
}

const patterns=[
 [/^自动实验步骤完成：(.+?)。(.*)$/, (m,l)=>choose(l,`自動実験の手順完了：${lessonTerm(m[1],l)}。${lessonTerm(m[2],l)}`,`Auto step completed: ${lessonTerm(m[1],l)}. ${lessonTerm(m[2],l)}`)],
 [/^教学演示：(.+?)完成。(.*)$/, (m,l)=>choose(l,`学習デモの手順完了：${lessonTerm(m[1],l)}。${lessonTerm(m[2],l)}`,`Guided demo step completed: ${lessonTerm(m[1],l)}. ${lessonTerm(m[2],l)}`)],
 [/^实验切换：(.+?)。现在液体加入、加热、微观画面使用同一实验状态。$/, (m,l)=>choose(l,`実験を切り替えました：${scenarioTitle(m[1])}。注液・加熱・ミクロ表示は共通の実験状態を使用します。`,`Experiment changed: ${scenarioTitle(m[1])}. Pouring, heating and microscopic view share one simulation state.`)],
 [/^已准备新实验：(.+)$/, (m,l)=>choose(l,`新しい実験を準備しました：${scenarioTitle(m[1])}`,`New experiment prepared: ${scenarioTitle(m[1])}`)],
 [/^辅助对准：(.+?)正在移动至(.+?)上方，接下来会逐步倒入([\d.]+)mL。$/, (m,l)=>choose(l,`補助位置合わせ：${name(m[1])}を${name(m[2])}の上へ移動し、${m[3]} mLを段階的に注ぎます。`,`Assisted alignment: moving ${name(m[1])} above ${name(m[2])}, then gradually pouring ${m[3]} mL.`)],
 [/^(已完成|已停止)辅助倒液：实际加入([\d.]+)\s*mL。瓶子已安全放回台面。$/, (m,l)=>choose(l,`${m[1]==='已完成'?'補助注液完了':'補助注液を停止'}：実際に${m[2]} mLを追加。瓶を安全に机へ戻しました。`,`${m[1]==='已完成'?'Assisted pour completed':'Assisted pour stopped'}: ${m[2]} mL added. Bottle returned safely to the desk.`)],
 [/^辅助倾倒已开始：(.+?)，目标 ([\d.]+)mL。请观察3D液滴与化学状态的同步变化。$/, (m,l)=>choose(l,`補助注液を開始しました：${name(m[1])}、目標${m[2]} mL。3Dの液滴と化学状態の連動を観察してください。`,`Assisted pour started: ${name(m[1])}, target ${m[2]} mL. Watch the 3D droplets and chemical state update together.`)],
 [/^无法辅助倾倒：(.+)$/, (m,l)=>choose(l,`補助注液できません：${name(m[1])}`,`Assisted pour unavailable: ${name(m[1])}`)],
 [/^从器材架取出：(.+?)。$/, (m,l)=>choose(l,`器具棚から取り出しました：${name(m[1])}。`,`Taken from equipment shelf: ${name(m[1])}.`)],
 [/^取出新试剂瓶：(.+?)。抓住后在接收器上方倾倒。$/, (m,l)=>choose(l,`新しい試薬瓶を取り出しました：${name(m[1])}。持ち上げて受け容器の上で注いでください。`,`New reagent bottle taken out: ${name(m[1])}. Pick it up and pour above the receiving vessel.`)],
 [/^已将(.+?)设为实验接收容器。$/, (m,l)=>choose(l,`${name(m[1])}を受け容器に設定しました。`,`Set ${name(m[1])} as the receiving vessel.`)],
 [/^(.+?)达到容量上限，超出部分洒出。$/, (m,l)=>choose(l,`${name(m[1])}が容量上限に達し、余分な液体がこぼれました。`,`${name(m[1])} reached capacity; excess liquid spilled.`)],
 [/^发现新现象：(.+)$/, (m,l)=>choose(l,`新しい現象を観察：${name(m[1])}`,`New observation: ${name(m[1])}`)],
 [/^(.+?)温度已达到约 ([\d.]+)°C。(.*)$/, (m,l)=>choose(l,`${name(m[1])}の温度が約${m[2]}°Cになりました。${name(m[3])}`,`${name(m[1])} reached approximately ${m[2]}°C. ${name(m[3])}`)],
 [/^演示快进15秒：(.+?)。这是加速学习模型，不能代表真实加热耗时。$/, (m,l)=>choose(l,`15秒の加熱を早送り：${name(m[1])}。加速した教材モデルであり、実際の加熱時間とは異なります。`,`Fast-forwarded 15 seconds of heating: ${name(m[1])}. This accelerated teaching model does not represent real heating time.`)],
 [/^试管加入蒸馏水 ([\d.]+)mL，试管液量 ([\d.]+)mL。(.*)$/, (m,l)=>choose(l,`試験管に蒸留水${m[1]} mLを加えました。現在量：${m[2]} mL。${name(m[3])}`,`Added ${m[1]} mL of distilled water to the test tube. Tube volume: ${m[2]} mL. ${name(m[3])}`)],
 [/^通过滴定管快捷入口加入NaOH ([\d.]+)mL（与3D容器共用化学状态）。$/, (m,l)=>choose(l,`ビュレット操作でNaOH ${m[1]} mLを追加しました（3D容器と化学状態を共有）。`,`Added ${m[1]} mL NaOH through the burette control (shared chemical state with the 3D vessel).`)],
 [/^(.+?)受到较大碰撞：玻璃破裂(，液体洒出)?。这是简化的破碎判定。$/, (m,l)=>choose(l,`${name(m[1])}が強く衝突して破損しました${m[2]?'。液体もこぼれました':''}。簡略化した破損判定です。`,`${name(m[1])} broke after a hard collision${m[2]?', spilling liquid':''}. Breakage is approximated.`)],
 [/^已确认(握拳式|捏合式)抓取 (.+?)；松开手才会释放。$/, (m,l)=>choose(l,`${m[1]==='握拳式'?'握りこみ':'ピンチ'}で${name(m[2])}をつかみました。手を開くと離します。`,`Grabbed ${name(m[2])} with a ${m[1]==='握拳式'?'power grip':'pinch grip'}. Open your hand to release.`)],
 [/^松开(.+?)：器材进入实时3D重力与碰撞计算。$/, (m,l)=>choose(l,`${name(m[1])}を離しました。3Dの重力・衝突計算が再開します。`,`Released ${name(m[1])}; real-time 3D gravity and collision physics resume.`)],
 [/^手(\d+)已做抓握动作，但没有碰到适合这种抓法的器材抓取点；请先张开手再尝试。$/, (m,l)=>choose(l,`手${m[1]}の握り動作は検出されましたが、対応する把持点に触れていません。手を開いて再試行してください。`,`Hand ${m[1]} gripped but did not reach a compatible grab point. Open your hand and try again.`)],
 [/^(.+?)向(.+?)流动：液量、反应和微观图像随之更新。$/, (m,l)=>choose(l,`${name(m[1])}から${name(m[2])}へ液体が移動し、液量・反応・ミクロ表示が更新されます。`,`Liquid flows from ${name(m[1])} to ${name(m[2])}; volume, reactions and microscopic view update together.`)],
 [/^(.+?)倾倒时没有接收容器，液体洒在桌面上。$/, (m,l)=>choose(l,`${name(m[1])}を傾けましたが受け容器がなく、液体が机にこぼれました。`,`${name(m[1])} was tilted without a receiving vessel; liquid spilled onto the desk.`)],
 [/^摄像头启动失败：(.+)$/, (m,l)=>choose(l,`カメラ起動失敗：${m[1]}`,`Camera startup failed: ${m[1]}`)],
 [/^拿起 (.+?) 试剂瓶$/, (m,l)=>choose(l,`${name(m[1])}の試薬瓶を取り出しました`,`Picked up reagent bottle: ${name(m[1])}`)],
 [/^已向容器加入(.+?) ([\d.]+) mL；(.*)$/, (m,l)=>choose(l,`${name(m[1])}を${m[2]} mL容器に加えました。${name(m[3])}`,`Added ${m[2]} mL of ${name(m[1])} to the vessel. ${name(m[3])}`)],
 [/^手动停止倒液，已加入 ([\d.]+) mL$/, (m,l)=>choose(l,`手動で注液を停止しました。添加量：${m[1]} mL`,`Pouring stopped manually after ${m[1]} mL was added.`)],
];

export function localizeActivityEvent(raw,language=getLanguage()){
 const text=String(raw??'');
 if(language==='zh')return text;
 if(language!=='en'&&language!=='ja')return text;
 const direct=template(text,language);if(direct)return direct;
 for(const [regexp,render] of patterns){const match=text.match(regexp);if(match)return render(match,language);}
 // Legacy/unrecognized events keep their original meaning. Don't fabricate an
 // English/Japanese translation from unrecognized scientific or error text.
 return text;
}

// Check coverage of all guided-plan messages in a unit test and at build time.
export function unmappedLessonMessages(){
 const missing=[];
 for(const steps of Object.values(LESSON_PLANS))for(const step of steps){
  if(!STEPS[step.title])missing.push('title: '+step.title);
  if(step.what&&!STEP_DETAILS[step.what])missing.push('detail: '+step.what);
 }
 return missing;
}
