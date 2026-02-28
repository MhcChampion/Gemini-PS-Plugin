const { app, core } = require("photoshop");
const fs = require("uxp").storage.localFileSystem;
const formats = require("uxp").storage.formats;

// --- 配置管理逻辑 ---
let apiType = localStorage.getItem("gemini_api_type") || "thirdparty";
let officialKey = localStorage.getItem("gemini_official_key") || "";
let tpUrl = localStorage.getItem("gemini_tp_url") || "";
// 默认给一个通用的、不易报错的模型名称
let tpModel = localStorage.getItem("gemini_tp_model") || "gemini-2.5-pro";
let tpKey = localStorage.getItem("gemini_tp_key") || "";

const toggleKeyBtn = document.getElementById("toggle-key-btn");
const keyPanel = document.getElementById("key-panel");
const saveKeyBtn = document.getElementById("save-key-btn");
const moduleImageOutput = document.getElementById("module-image-output");

const radioOfficial = document.querySelector('input[value="official"]');
const radioThirdparty = document.querySelector('input[value="thirdparty"]');
const officialSettings = document.getElementById("official-settings");
const thirdpartySettings = document.getElementById("thirdparty-settings");

const offKeyInput = document.getElementById("official-key-input");
const tpUrlInput = document.getElementById("tp-url-input");
const tpModelInput = document.getElementById("tp-model-input");
const tpKeyInput = document.getElementById("tp-key-input");

offKeyInput.value = officialKey;
tpUrlInput.value = tpUrl;
tpModelInput.value = tpModel;
tpKeyInput.value = tpKey;

if (apiType === "official") {
    radioOfficial.checked = true;
    officialSettings.style.display = "block";
    thirdpartySettings.style.display = "none";
} else {
    radioThirdparty.checked = true;
    officialSettings.style.display = "none";
    thirdpartySettings.style.display = "block";
}

document.querySelectorAll('input[name="api-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        apiType = e.target.value;
        if (apiType === "official") {
            officialSettings.style.display = "block";
            thirdpartySettings.style.display = "none";
        } else {
            officialSettings.style.display = "none";
            thirdpartySettings.style.display = "block";
        }
    });
});

toggleKeyBtn.addEventListener("click", () => {
    if (keyPanel.style.display === "block") {
        keyPanel.style.display = "none";
        toggleKeyBtn.innerHTML = "⚙️ 接口与模型配置 (已隐藏) <span>▼</span>";
    } else {
        keyPanel.style.display = "block";
        toggleKeyBtn.innerHTML = "⚙️ 接口与模型配置 (点击收起) <span>▲</span>";
    }
});

saveKeyBtn.addEventListener("click", () => {
    localStorage.setItem("gemini_api_type", apiType);

    officialKey = offKeyInput.value.trim();
    localStorage.setItem("gemini_official_key", officialKey);

    tpUrl = tpUrlInput.value.trim();
    localStorage.setItem("gemini_tp_url", tpUrl);

    tpModel = tpModelInput.value.trim();
    localStorage.setItem("gemini_tp_model", tpModel);

    tpKey = tpKeyInput.value.trim();
    localStorage.setItem("gemini_tp_key", tpKey);

    keyPanel.style.display = "none";
    toggleKeyBtn.innerHTML = "⚙️ 接口与模型配置 (保存成功) <span>▼</span>";
    setTimeout(() => { toggleKeyBtn.innerHTML = "⚙️ 接口与模型配置 (点击展开) <span>▼</span>"; }, 2000);
});

function arrayBufferToBase64(buffer) {
    let binary = '';
    let bytes = new Uint8Array(buffer);
    let len = bytes.byteLength;
    for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); }
    return btoa(binary);
}

async function getCanvasBase64() {
    if (!app.activeDocument) throw new Error("PS 中没有打开的文档，无法获取画面！");
    let base64Image = "";
    await core.executeAsModal(async () => {
        const pluginFolder = await fs.getDataFolder();
        const tempFile = await pluginFolder.createFile("temp_canvas.jpg", { overwrite: true });
        await app.activeDocument.saveAs.jpg(tempFile, { quality: 5 }, true);
        const buffer = await tempFile.read({ format: formats.binary });
        base64Image = arrayBufferToBase64(buffer);
        await tempFile.delete();
    }, { commandName: "提取画面给 AI" });
    return base64Image;
}

async function sendImageToPhotoshop(imageUrl) {
    if (!app.activeDocument) throw new Error("PS 中没有打开的文档，无法发送图片！");
    const outputArea = document.getElementById("output-area");
    outputArea.innerHTML += "<br><br><span style='color:#1473E6'>正在拉取图片并发送到 PS，请稍候...</span>";

    try {
        const imageResponse = await fetch(imageUrl);
        const imageDataArrayBuffer = await imageResponse.arrayBuffer();

        await core.executeAsModal(async () => {
            const pluginFolder = await fs.getDataFolder();
            const tempFile = await pluginFolder.createFile("generated_image_to_ps.jpg", { overwrite: true });
            await tempFile.write({ data: Array.from(new Uint8Array(imageDataArrayBuffer)), format: formats.binary });
            await app.openAsNew(tempFile);
            await tempFile.delete();
        }, { commandName: "发送图片到 PS" });

        outputArea.innerHTML += "<br><span style='color:#28a745'>图片已成功发送到 PS！</span>";
    } catch (error) {
        outputArea.innerHTML += `<br><span style='color:#ff5555'>下载图片失败：可能是该图片链接失效或服务器拒绝访问。(${error.toString()})</span>`;
    }
}

document.getElementById("output-area").addEventListener("click", async (e) => {
    if (e.target && e.target.classList.contains("copy-code-btn")) {
        const textToCopy = decodeURIComponent(e.target.getAttribute("data-code"));
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(textToCopy);
            } else throw new Error("转入备用方案");
        } catch (err) {
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
        }
        const originalText = e.target.innerText;
        e.target.innerText = "已复制 ✓";
        e.target.style.backgroundColor = "#28a745";
        setTimeout(() => { e.target.innerText = originalText; e.target.style.backgroundColor = "#1473E6"; }, 2000);
    }
});

// --- 社区版核心重构：全局视觉设计与排版提示词 ---
const systemPrompt = "你是一个顶级的视觉设计与排版AI助手。你的主要任务是帮助设计师优化画面、调色、排版和字体选择。\n\n1. 【文本排版与断句】：当用户发送多语种（或中文）文本需要排版时，请帮其进行符合视觉美学和语言习惯的断句。断句结果必须以可复制的代码行格式提供，并附带适合该设计风格的字体建议（必须明确指定为免费商用字体）。\n2. 【画面诊断与优化】：当用户附带图片发送请求时，请提供专业的画面修改建议，包含：构图/主体细节调整、整体调色/光影方向、以及排版布局的专业建议。\n\n注意：你目前是一个纯文本模型，不具备直接生成图片的能力。如果用户要求生图，请直接回复具体的文字视觉建议，绝对不要自己编造或返回虚假的 https 格式的图片链接。";

document.getElementById("send-btn").addEventListener("click", async () => {
    const promptText = document.getElementById("prompt-input").value;
    const includeCanvas = document.getElementById("include-canvas").checked;
    const outputArea = document.getElementById("output-area");
    const imagePlaceholder = document.getElementById("image-placeholder");
    const generatedImage = document.getElementById("generated-image");
    const imageMetaArea = document.getElementById("image-meta-area");

    if (apiType === "official" && !officialKey) {
        outputArea.innerHTML = "<span style='color:#ff5555'>提示：请先在顶部填入官方 API Key！</span>";
        keyPanel.style.display = "block"; return;
    }
    if (apiType === "thirdparty" && (!tpUrl || !tpModel || !tpKey)) {
        outputArea.innerHTML = "<span style='color:#ff5555'>提示：请先在顶部完善第三方代理配置！</span>";
        keyPanel.style.display = "block"; return;
    }
    if (!promptText) { outputArea.innerHTML = "提示：请先输入您的设计需求哦！"; return; }

    moduleImageOutput.style.display = "none";
    outputArea.innerHTML = `正在通过 [${apiType === 'official' ? '官方接口' : '代理接口'}] 进行专业分析，请稍候...`;

    try {
        let aiText = "";
        let base64Image = "";

        if (includeCanvas) {
            outputArea.innerHTML = "正在提取当前 PS 画面，请稍候...";
            base64Image = await getCanvasBase64();
            outputArea.innerHTML = "画面提取成功，正在请求 AI 进行视觉诊断...";
        }

        if (apiType === "official") {
            let parts = [{ text: promptText }];
            if (includeCanvas) {
                parts.push({ inline_data: { mime_type: "image/jpeg", data: base64Image } });
            }
            const requestBody = {
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: parts }]
            };
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${officialKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            aiText = data.candidates[0].content.parts[0].text;

        } else {
            let userContent = [{ type: "text", text: promptText }];
            if (includeCanvas) {
                userContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } });
            }
            const requestBody = {
                model: tpModel,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent }
                ]
            };

            let cleanBaseUrl = tpUrl.replace(/\/v1\/?$/, "").replace(/\/+$/, "");

            const response = await fetch(`${cleanBaseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tpKey}` },
                body: JSON.stringify(requestBody)
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
            aiText = data.choices[0].message.content;
        }

        const imageUrlRegex = /https?:\/\/([^\s]+)\.(jpg|png|webp|jpeg)/gi;
        const imageUrlMatch = aiText.match(imageUrlRegex);

        if (imageUrlMatch) {
            moduleImageOutput.style.display = "flex";
            generatedImage.src = imageUrlMatch[0];
            imagePlaceholder.style.display = "none";
            generatedImage.style.display = "block";
            imageMetaArea.style.display = "flex";
            aiText = aiText.replace(imageUrlRegex, "");
        }

        aiText = aiText.replace(/\n/g, "<br>");
        aiText = aiText.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        aiText = aiText.replace(/### (.*?)<br>/g, "<h3>$1</h3>");

        aiText = aiText.replace(/```(?:[a-zA-Z]*)(?:<br>)?([\s\S]*?)```/g, (match, codeContent) => {
            let plainText = codeContent.replace(/<br>/g, "\n").trim();
            const safeCode = encodeURIComponent(plainText);
            return `<div style="position: relative; margin: 15px 0;">
                        <button class="copy-code-btn" data-code="${safeCode}" style="position: absolute; top: 8px; right: 8px; background: #1473E6; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; z-index: 10;">复制排版</button>
                        <pre style="background: #111; margin: 0; padding: 35px 10px 10px 10px; border-radius: 4px; font-family: monospace; border: 1px solid #555; color: #ddd; overflow-x: auto;"><code>${codeContent}</code></pre>
                    </div>`;
        });
        outputArea.innerHTML = aiText;

    } catch (error) {
        outputArea.innerHTML = "<span style='color:#ff5555'>请求出错啦：" + error.message + "</span>";
    }
});

document.getElementById("send-to-ps-btn").addEventListener("click", () => {
    const generatedImage = document.getElementById("generated-image");
    if (generatedImage.src) { sendImageToPhotoshop(generatedImage.src); }
});

document.getElementById("clear-btn").addEventListener("click", () => {
    document.getElementById("prompt-input").value = "";
    document.getElementById("output-area").innerHTML = "等待诊断...";
    document.getElementById("include-canvas").checked = false;
    moduleImageOutput.style.display = "none";
    document.getElementById("image-placeholder").innerHTML = "等待生成...";
    document.getElementById("image-placeholder").style.display = "flex";
    document.getElementById("generated-image").src = "";
});