import { api } from './api';
import { useSettingsStore } from '@/store/settings-store';
import { useEditorStore } from '@/store/editor-store';
import { useChatStore } from '@/store/chat-store';
import { AI_MODELS } from '@shared/models';
import { processAgentResponse } from './agent';
import type { AIProvider, ToolCall } from '@shared/types';
import { getLanguageFromPath } from './utils';

/** Flatten file tree into a compact path list (with budget early-exit to avoid lag) */
function flattenTree(entries: any[], prefix = '', limit = 200, out: string[] = []): string[] {
  if (out.length >= limit) return out;
  for (const e of entries ?? []) {
    if (out.length >= limit) break;
    const name = e.name ?? e.path?.split('/').pop() ?? '';
    if (!name) continue;
    if (name.startsWith('.') || name === 'node_modules' || name === 'dist' || name === 'build') continue;
    const full = prefix ? `${prefix}/${name}` : name;
    if (e.kind === 'directory' || e.children) {
      out.push(`${full}/`);
      if (e.children) flattenTree(e.children, full, limit, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

/** Build the system prompt with project context */
function buildSystemPrompt(): string {
  const editorState = useEditorStore.getState();
  const { rootPath, contextFiles, openFiles, fileTree, activeFilePath } = editorState;
  const agentMode = useChatStore.getState().agentMode;

  let system = `Eres CodeAI, el asistente de programación integrado en este IDE. Hablas en español.

¡REGLA ABSOLUTA DE ACCESO A ARCHIVOS (CRÍTICO - OBLIGATORIO)!:
- Tienes acceso COMPLETO y en tiempo real a la estructura de archivos y al código del proyecto actual del usuario.
- Si el usuario te pregunta "¿puedes ver mis archivos?", "¿puedo ver los archivos indexados?" o consultas similares, responde SIEMPRE con un rotundo SÍ, y demuéstralo de inmediato.
- NUNCA digas "no tengo acceso directo a los archivos locales" o "soy un modelo de texto y no puedo ver tus archivos". Eso es FALSO en este IDE. Tienes el contexto del proyecto inyectado en este prompt y debes usarlo.
- Demuestra que sí puedes verlos listando los archivos que tienes en el "ÁRBOL DEL PROYECTO" o el contenido de los "ARCHIVOS EN CONTEXTO" a continuación.

PERSONALIDAD Y ESTILO DE COMUNICACIÓN:
- Habla como un compañero programador, no como un robot. Sé natural y directo.
- Usa lenguaje sencillo y claro. Nada de formalidades innecesarias.
- Sé conciso: ve al grano. Si la respuesta es corta, que sea corta.
- Cuando expliques algo técnico, hazlo como si se lo explicaras a un colega en el trabajo.
- Usa emojis con moderación, solo cuando aporten claridad (✅ para éxito, ❌ para errores, etc.).
- Si no sabes algo, dilo sin rodeos.
- Puedes usar expresiones casuales como "listo", "va", "dale", "perfecto", "ojo con esto".
- NO uses frases genéricas tipo "¡Claro! Con mucho gusto te ayudo con eso." — simplemente ayuda.
- NO repitas lo que el usuario acaba de decir. Ve directo a la solución.
- Cuando muestres código, sé práctico: muestra solo lo relevante, no todo el archivo si no hace falta.`;

  if (agentMode) {
    system += `\n\n══════════ MODO AGENTE (¡CRÍTICO: COMPORTAMIENTO AUTÓNOMO!) ══════════
¡ERES UN AGENTE AUTÓNOMO, NO UN ASISTENTE DE TEXTO!
TIENES que usar tus herramientas para hacer el trabajo POR el usuario.

¡IMPORTANTE - EJECUCIÓN DE HERRAMIENTAS!:
Si eres un modelo que no soporta llamadas a herramientas nativas en la API (o si esta las ignora), DEBES invocar las herramientas escribiendo directamente etiquetas XML en tu texto de respuesta. El IDE interceptará, ejecutará la herramienta de forma automática en el sistema y te devolverá el resultado. Usa los siguientes formatos exactos:

- Leer un archivo: <read_file path="src/client/App.tsx" />
- Crear/Editar un archivo (siempre escribe el contenido COMPLETO):
<write_file path="src/client/prueba.txt">CONTENIDO_COMPLETO</write_file>
- Listar archivos de una carpeta: <list_files path="src" />
- Buscar texto en el proyecto: <search_files query="mi_busqueda" />
- Ejecutar comando de terminal: <run_command command="npm install" />

REGLAS ESTRICTAS E INQUEBRANTABLES:
1. ¡NUNCA le pidas al usuario que ejecute comandos en la terminal o modifique archivos de forma manual! DEBES usar las herramientas nativas o las etiquetas XML tú mismo.
2. El usuario te está usando para que TÚ hagas el trabajo de programación y consola, no para leer tutoriales. Actúa directamente sobre el proyecto.
3. SIEMPRE lee un archivo antes de editarlo con \`read_file\` si existe.
4. Explica brevemente lo que vas a hacer e INMEDIATAMENTE invoca la herramienta (ya sea de forma nativa o mediante su tag XML).
5. ¡CRÍTICO! NO uses \`run_command\` para iniciar servidores (ej. \`node server.js\`, \`npm run dev\`, \`npm start\`). La herramienta es síncrona y bloqueará el IDE entero. Si el usuario te pide arrancar un servidor, dile amablemente que tú no puedes mantener un servidor vivo en background, y pídele que use ÉL MISMO la terminal del IDE.`;
  } else {
    system += `\nCuando generes código, usa bloques con el lenguaje indicado.`;
  }

  if (rootPath) {
    system += `\n\nProyecto abierto en: ${rootPath}`;
  }

  // Project tree (compact, top 200 entries, optimized early exit)
  if (fileTree && fileTree.length > 0) {
    const paths = flattenTree(fileTree as any[], '', 200);
    if (paths.length > 0) {
      system += `\n\n--- ÁRBOL DEL PROYECTO ---\n${paths.join('\n')}`;
    }
  }

  // Include open files in context (for both modes)
  const filesToInclude = new Set<string>();
  if (agentMode) {
    if (activeFilePath) filesToInclude.add(activeFilePath);
    for (const p of openFiles.keys()) filesToInclude.add(p);
  }
  for (const p of contextFiles) filesToInclude.add(p);

  if (filesToInclude.size > 0) {
    system += '\n\n--- ARCHIVOS EN CONTEXTO ---';
    let total = 0;
    const BUDGET = 40000;
    for (const path of filesToInclude) {
      if (total >= BUDGET) break;
      const file = openFiles.get(path);
      if (file) {
        const slice = file.content.slice(0, Math.min(8000, BUDGET - total));
        system += `\n\n### ${path}\n\`\`\`\n${slice}\n\`\`\``;
        total += slice.length;
      }
    }
  }

  return system;
}

/** Get route and headers for a given provider */
function getProviderConfig(provider: AIProvider, apiKeys: Record<string, string>) {
  switch (provider) {
    case 'claude':
      return { path: '/api/ai/claude', headers: { 'x-api-key': apiKeys.claude || '' } };
    case 'openai':
      return { path: '/api/ai/openai', headers: { 'Authorization': `Bearer ${apiKeys.openai || ''}` } };
    case 'gemini':
      return { path: '/api/ai/gemini', headers: {} };
    case 'deepseek':
      return { path: '/api/ai/deepseek', headers: { 'Authorization': `Bearer ${apiKeys.deepseek || ''}` } };
    case 'nvidia':
      return { path: '/api/ai/nvidia', headers: { 'Authorization': `Bearer ${apiKeys.nvidia || ''}` } };
    case 'openrouter':
      return { path: '/api/ai/openrouter', headers: { 'Authorization': `Bearer ${apiKeys.openrouter || ''}` } };
    default:
      return { path: '/api/ai/openai', headers: {} };
  }
}

/** Build request body for each provider (non-agent mode) with image support */
function buildRequestBody(
  provider: AIProvider,
  modelId: string,
  messages: { role: string; content: string; attachments?: any[] }[],
  system: string,
) {
  const model = AI_MODELS[modelId];
  const apiModelId = model?.apiModelId ?? modelId;

  switch (provider) {
    case 'claude': {
      const formattedMessages = messages.filter((m) => m.role !== 'system').map((m) => {
        if (m.attachments && m.attachments.length > 0) {
          const contentArray: any[] = [{ type: 'text', text: m.content || '' }];
          for (const att of m.attachments) {
            if (att.type === 'image' && att.content) {
              const base64Data = att.content.split(',')[1];
              if (base64Data) {
                contentArray.push({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: att.mime || 'image/jpeg',
                    data: base64Data
                  }
                });
              }
            }
          }
          return { role: m.role, content: contentArray };
        }
        return { role: m.role, content: m.content };
      });

      return {
        model: apiModelId,
        max_tokens: model?.maxTokens ?? 4096,
        system,
        messages: formattedMessages,
        stream: true,
      };
    }
    case 'gemini': {
      const contents = messages.map((m) => {
        const parts: any[] = [{ text: m.content || '' }];
        if (m.attachments && m.attachments.length > 0) {
          for (const att of m.attachments) {
            if (att.type === 'image' && att.content) {
              const base64Data = att.content.split(',')[1];
              if (base64Data) {
                parts.push({
                  inlineData: {
                    mimeType: att.mime || 'image/jpeg',
                    data: base64Data
                  }
                });
              }
            }
          }
        }
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts,
        };
      });

      return {
        apiKey: useSettingsStore.getState().apiKeys.gemini,
        model: apiModelId,
        body: {
          contents,
          systemInstruction: { parts: [{ text: system }] },
        },
      };
    }
    case 'openai':
    case 'deepseek':
    case 'nvidia':
    case 'openrouter':
    default: {
      const formattedMessages = messages.map((m) => {
        if (m.attachments && m.attachments.length > 0) {
          const contentArray: any[] = [{ type: 'text', text: m.content || '' }];
          for (const att of m.attachments) {
            if (att.type === 'image' && att.content) {
              contentArray.push({
                type: 'image_url',
                image_url: { url: att.content }
              });
            }
          }
          return { role: m.role, content: contentArray };
        }
        return { role: m.role, content: m.content };
      });

      const firstUserMsgIndex = formattedMessages.findIndex(m => m.role === 'user');
      if (firstUserMsgIndex !== -1) {
        const firstMsg = formattedMessages[firstUserMsgIndex];
        if (Array.isArray(firstMsg.content)) {
          // It's a structured message with image parts
          const textPart = firstMsg.content.find((p: any) => p.type === 'text');
          if (textPart) {
            textPart.text = `${system}\n\n---\n\n${textPart.text}`;
          } else {
            firstMsg.content.unshift({ type: 'text', text: system });
          }
        } else {
          // Plain string content
          formattedMessages[firstUserMsgIndex] = {
            ...firstMsg,
            content: `${system}\n\n---\n\n${firstMsg.content}`
          };
        }
      } else {
        formattedMessages.unshift({ role: 'user', content: `${system}\n\n---\n\nPor favor inicia la sesión.` });
      }

      return {
        model: apiModelId,
        messages: formattedMessages,
        max_tokens: model?.maxTokens ?? 4096,
        stream: true,
      };
    }
  }
}

// ═══════════════════════════════════════
// ADAPTIVE MODEL ROUTER — Intelligent model selection
// ═══════════════════════════════════════

type TaskComplexity = 'heavy' | 'medium' | 'light';
type TaskType = 'code' | 'reasoning' | 'general';

function detectTask(userMessage: string, historyLength: number, agentMode: boolean): { complexity: TaskComplexity; type: TaskType; approxTokens: number } {
  const lower = userMessage.toLowerCase();
  const approxTokens = historyLength / 4;

  // Detect task type
  const codeKeywords = ['función', 'funcion', 'class', 'import', 'export', 'component', 'api', 'endpoint', 'bug', 'error', 'debug', 'refactor', 'typescript', 'javascript', 'python', 'html', 'css', 'react', 'código', 'codigo', 'archivo', 'file', 'crea', 'modifica', 'implementa', 'programa', 'script', 'variable', 'array', 'objeto', 'loop', 'for', 'while', 'if', 'else', 'return', 'async', 'await', 'promise', 'fetch', 'database', 'sql', 'query', 'schema', 'migration', 'deploy', 'build', 'compile', 'test', 'jest', 'npm', 'yarn', 'git'];
  const reasoningKeywords = ['explica', 'por qué', 'porqué', 'analiza', 'compara', 'evalúa', 'evalua', 'piensa', 'razona', 'arquitectura', 'diseño', 'patrón', 'patron', 'trade-off', 'ventajas', 'desventajas', 'pros', 'cons', 'mejor', 'peor', 'opción', 'opcion', 'estrategia', 'plan', 'optimiza'];
  
  const codeScore = codeKeywords.filter(k => lower.includes(k)).length;
  const reasoningScore = reasoningKeywords.filter(k => lower.includes(k)).length;
  
  let type: TaskType = 'general';
  if (codeScore > reasoningScore && codeScore >= 2) type = 'code';
  else if (reasoningScore > codeScore && reasoningScore >= 2) type = 'reasoning';
  else if (codeScore >= 1) type = 'code'; // bias toward code in an IDE

  // Detect complexity
  let complexity: TaskComplexity = 'light';
  if (agentMode || approxTokens > 6000 || lower.length > 500) {
    complexity = 'heavy';
  } else if (approxTokens > 2000 || lower.length > 200 || codeScore >= 3 || reasoningScore >= 2) {
    complexity = 'medium';
  }

  return { complexity, type, approxTokens };
}

/** Check if a model is available (has API key or is free) */
function isModelAvailable(modelId: string, apiKeys: Record<string, string>): boolean {
  const model = AI_MODELS[modelId];
  if (!model) return false;
  
  // Free-tier providers don't need API keys
  const freeProviders = ['nvidia', 'openrouter'];
  if (freeProviders.includes(model.provider)) return true;
  
  // Gemini free-tier models don't need keys (they use AI Studio)
  if (model.provider === 'gemini' && model.tier === 'free') return true;
  
  // Paid providers need API keys
  const key = apiKeys[model.provider];
  return !!key && key.trim().length > 0;
}

/** Check if a model is within its daily limit */
function isWithinLimit(modelId: string, modelUsage: Record<string, { date: string; tokens: number; requests: number }>): boolean {
  const model = AI_MODELS[modelId];
  if (!model || !model.dailyLimit || model.dailyLimit.value === 0) return true; // paid = no free limit but still usable
  
  const today = new Date().toISOString().split('T')[0];
  const usage = modelUsage[modelId];
  if (!usage || usage.date !== today) return true; // no usage today = within limit
  
  const dl = model.dailyLimit;
  if (dl.type === 'requests') {
    return (usage.requests ?? 0) < dl.value;
  } else {
    return usage.tokens < dl.value;
  }
}

/** Get usage percentage for a model (0-100) */
function getUsagePercent(modelId: string, modelUsage: Record<string, { date: string; tokens: number; requests: number }>): number {
  const model = AI_MODELS[modelId];
  if (!model?.dailyLimit || model.dailyLimit.value === 0) return 0;
  
  const today = new Date().toISOString().split('T')[0];
  const usage = modelUsage[modelId];
  if (!usage || usage.date !== today) return 0;
  
  const dl = model.dailyLimit;
  const consumed = dl.type === 'requests' ? (usage.requests ?? 0) : usage.tokens;
  return Math.min(100, Math.round((consumed / dl.value) * 100));
}

/** Rank score: higher = better quality */
function getModelQualityScore(modelId: string): number {
  const id = modelId.toLowerCase();
  // S-tier
  if (id.includes('claude-opus') || id.includes('gemini-3.5') || id.includes('qwen3-coder-480b')) return 100;
  if (id.includes('claude-sonnet') || id.includes('deepseek-v4-pro')) return 95;
  // A-tier
  if (id.includes('deepseek-v4-flash') || id.includes('gemini-2.5-pro') || id.includes('gemini-2.5-flash') || id.includes('codestral') || id.includes('mistral-small') || id.includes('mistral-medium')) return 80;
  // B-tier  
  if (id.includes('qwen') || id.includes('nemotron') || id.includes('deepseek-v3') || id.includes('deepseek-r1') || id.includes('gpt-oss') || id.includes('glm') || id.includes('kimi') || id.includes('minimax') || id.includes('gemma') || id.includes('seed') || id.includes('step')) return 60;
  // C-tier
  if (id.includes('llama') || id.includes('flash-lite')) return 40;
  return 50;
}

/** The main adaptive selection algorithm */
function adaptiveSelectModel(userMessage: string, historyText: string, agentMode: boolean): { modelId: string; reason: string; approxTokens: number } {
  const chatStore = useChatStore.getState();
  const settingsStore = useSettingsStore.getState();
  const apiKeys = settingsStore.apiKeys as unknown as Record<string, string>;
  const { modelUsage } = chatStore;

  const { complexity, type, approxTokens } = detectTask(userMessage, historyText.length, agentMode);
  
  // Build candidate list: all models that are available and within limits
  const candidates = Object.values(AI_MODELS)
    .filter(m => isModelAvailable(m.id, apiKeys))
    .filter(m => isWithinLimit(m.id, modelUsage));

  if (candidates.length === 0) {
    return { modelId: 'gemini-2.5-flash', reason: 'Fallback — sin modelos disponibles con cuota', approxTokens };
  }

  // Score each candidate
  const scored = candidates.map(m => {
    let score = getModelQualityScore(m.id);
    const usagePct = getUsagePercent(m.id, modelUsage);
    
    // Prefer less-used models (save quota)
    score -= usagePct * 0.3;
    
    // Prefer free models over paid
    if (m.tier === 'free') score += 15;
    else if (m.tier === 'paid') score -= 20;
    else if (m.tier === 'premium') score -= 40;

    // Capability matching
    if (type === 'code' && m.capabilities.includes('code')) score += 10;
    if (type === 'reasoning' && m.capabilities.includes('reasoning')) score += 10;
    
    // Context window: penalize if conversation might not fit
    if (approxTokens > m.contextWindow * 0.5) score -= 30;

    // For heavy tasks, boost high-quality models
    if (complexity === 'heavy') {
      score += getModelQualityScore(m.id) * 0.3;
    }
    // For light tasks, boost cheap/fast models
    if (complexity === 'light') {
      if (m.tier === 'free') score += 20;
      if (m.id.includes('flash') || m.id.includes('lite') || m.id.includes('8b') || m.id.includes('nano')) score += 15;
    }

    return { model: m, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  const best = scored[0];
  const tierLabel = best.model.tier === 'free' ? 'gratis' : best.model.tier;
  const complexityLabel = complexity === 'heavy' ? 'compleja' : complexity === 'medium' ? 'moderada' : 'simple';
  const typeLabel = type === 'code' ? 'código' : type === 'reasoning' ? 'razonamiento' : 'general';
  
  const reason = `Tarea ${complexityLabel} (${typeLabel}) · ${tierLabel} · ~${Math.round(approxTokens)} tok · ${Math.round(best.score)} pts`;
  
  return { modelId: best.model.id, reason, approxTokens };
}

// ═══════════════════════════════════════
// Agent mode: stream via agentic loop
// ═══════════════════════════════════════

async function streamAgentChat(): Promise<void> {
  const chatStore = useChatStore.getState();
  const settingsStore = useSettingsStore.getState();
  const editorState = useEditorStore.getState();
  const { selectedModel, sessions, activeSessionId } = chatStore;

  const system = buildSystemPrompt();
  
  let actualModelId = selectedModel;
  let model = AI_MODELS[actualModelId];

  if (selectedModel === 'adaptive') {
    const session = sessions.find((s) => s.id === activeSessionId);
    const historyText = (session?.messages ?? []).slice(-10).map((m: any) => m.content).join('\n');
    const lastUserMsg = (session?.messages ?? []).filter((m: any) => m.role === 'user').pop()?.content ?? '';
    
    const result = adaptiveSelectModel(lastUserMsg, historyText + system, chatStore.agentMode);
    actualModelId = result.modelId;
    model = AI_MODELS[actualModelId];
    
    chatStore.addMessage({
      id: Date.now().toString(36),
      role: 'assistant',
      content: `🔀 **Adaptive →** ${model.label} *(${(AI_MODELS[actualModelId] as any).provider})* — ${result.reason}`,
      timestamp: Date.now(),
      model: actualModelId
    });
  }

  if (!model) {
    chatStore.addMessage({ id: Date.now().toString(36), role: 'assistant', content: 'Error: modelo no encontrado.', timestamp: Date.now() });
    return;
  }

  const apiKeys = settingsStore.apiKeys as unknown as Record<string, string>;
  const apiModelId = model.apiModelId;

  // Build messages
  const session = sessions.find((s) => s.id === activeSessionId);
  const historyMessages = (session?.messages ?? [])
    .filter((m: any) => m.role !== 'system')
    .slice(-20)
    .map((m: any) => ({ role: m.role, content: m.content, attachments: m.attachments, reasoning_content: m.reasoning_content }));

  // Determine which API key to send
  const providerKey = apiKeys[model.provider] || '';

  // Resolve active GitHub token
  const settingsState = useSettingsStore.getState();
  const githubAccounts = settingsState.githubAccounts || [];
  const activeGithubAccount = settingsState.activeGithubAccount;
  const activeAccount = githubAccounts.find((a: any) => a.username === activeGithubAccount) || githubAccounts[0];

  const body = {
    messages: historyMessages,
    model: apiModelId,
    provider: model.provider,
    system,
    projectRoot: editorState.rootPath || '',
    apiKey: providerKey,
    maxIterations: 1000,
    githubToken: activeAccount?.token || '',
    sessionId: activeSessionId || '',
  };

  chatStore.setStreaming(true);
  chatStore.setStreamContent('');

  const toolCalls: ToolCall[] = [];
  const agentChanges: { path: string; oldContent: string; newContent: string }[] = [];
  let fullContent = '';

  try {
    const { response, abort } = api.streamAgent(body);
    
    // Create an abort controller that triggers the api.abort() and store it
    const ctrl = new AbortController();
    ctrl.signal.addEventListener('abort', () => abort());
    chatStore.setAbortController(ctrl);

    const res = await response;

    if (!res.ok) {
      const errText = await res.text();
      chatStore.addMessage({
        id: Date.now().toString(36), role: 'assistant',
        content: `Error ${res.status}: ${errText.slice(0, 200)}`,
        timestamp: Date.now(), model: selectedModel,
      });
      chatStore.setStreaming(false);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // keep incomplete line in buffer

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          try {
            const data = JSON.parse(dataStr);
            handleAgentEvent(currentEvent, data, toolCalls, agentChanges, (text) => {
              fullContent += text;
              chatStore.setStreamContent(fullContent);
            });
          } catch {
            // skip malformed JSON
          }
        }
      }
    }

    // Build the final assistant message with tool call info
    let finalContent = fullContent || '(sin respuesta)';
    if (toolCalls.length > 0) {
      const toolSummary = toolCalls.map((tc) => {
        const icon = tc.name === 'read_file' ? '📖' : tc.name === 'write_file' ? '✏️' : tc.name === 'list_files' ? '📁' : tc.name === 'search_files' ? '🔍' : '⚡';
        return `${icon} \`${tc.name}\`(${formatToolArgs(tc.args)})`;
      }).join('\n');

      finalContent = `**Herramientas usadas:**\n${toolSummary}\n\n---\n\n${finalContent}`;
    }

    chatStore.addMessage({
      id: Date.now().toString(36), role: 'assistant',
      content: finalContent,
      timestamp: Date.now(), model: actualModelId,
      agentChanges: agentChanges.length > 0 ? agentChanges : undefined,
    });

    const promptTokens = Math.ceil((system.length + JSON.stringify(historyMessages).length) / 4);
    const completionTokens = Math.ceil(finalContent.length / 4);
    chatStore.incrementModelUsage(actualModelId, promptTokens + completionTokens);

    // file changes are now processed natively in handleAgentEvent

  } catch (e: any) {
    if (e.name !== 'AbortError') {
      chatStore.addMessage({
        id: Date.now().toString(36), role: 'assistant',
        content: `Error: ${e.message}`,
        timestamp: Date.now(), model: selectedModel,
      });
    }
  } finally {
    chatStore.setStreaming(false);
    chatStore.setStreamContent('');
    chatStore.setAbortController(null);
  }
}

function handleAgentEvent(
  event: string,
  data: any,
  toolCalls: ToolCall[],
  agentChanges: { path: string; oldContent: string; newContent: string }[],
  appendContent: (text: string) => void,
): void {
  switch (event) {
    case 'status':
      if (data.type === 'thinking') {
        appendContent(`⏳ ...\n\n`);
      } else if (data.type === 'rate_limit') {
        appendContent(`⚠️ Límite de peticiones alcanzado (429). Reintentando en ${(data.delay / 1000).toFixed(1)}s... (Intento ${data.attempt}/${data.maxAttempts})\n\n`);
      }
      break;

    case 'tool_call':
      toolCalls.push({
        id: data.id,
        name: data.name,
        args: data.args,
        status: 'running',
      });
      {
        const icon = data.name === 'read_file' ? '📖' : data.name === 'write_file' ? '✏️' : data.name === 'list_files' ? '📁' : data.name === 'search_files' ? '🔍' : '⚡';
        appendContent(`${icon} Ejecutando \`${data.name}\`(${formatToolArgs(data.args)})...\n`);
      }
      break;

    case 'tool_result': {
      const tc = toolCalls.find((t) => t.id === data.id);
      if (tc) {
        tc.status = 'done';
        tc.result = data.result;
      }
      appendContent(`✅ Resultado recibido\n\n`);
      break;
    }

    case 'file_change': {
      const tc = toolCalls.find((t) => t.name === 'write_file' && t.status === 'done' && !t.fileChange);
      if (tc) {
        tc.fileChange = { path: data.path, content: data.content };
      }
      
      const editorStore = useEditorStore.getState();
      const existing = editorStore.openFiles.get(data.path);
      const originalContent = data.oldContent || '';

      agentChanges.push({
        path: data.path,
        oldContent: originalContent,
        newContent: data.content,
      });
      
      // Asegurarse de que el archivo esté abierto con su contenido original antes de previsualizar
      if (!existing) {
        editorStore.openFile(data.path, {
          path: data.path,
          content: originalContent,
          language: getLanguageFromPath(data.path),
          modified: false,
        });
      }

      const changeId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      editorStore.addPendingChange({
        id: changeId,
        type: 'replace',
        file: data.path,
        content: data.content,
        original: originalContent,
        status: 'pending',
      });
      
      editorStore.applyPreview(data.path, originalContent, data.content, changeId);

      appendContent(`📝 Archivo modificado: \`${data.path}\`\n`);
      break;
    }

    case 'content':
      // Clear the "thinking" prefix and show actual content
      appendContent(data.text || '');
      break;

    case 'error':
      appendContent(`\n❌ Error: ${data.message}\n`);
      break;

    case 'done':
      // Stream complete
      break;
  }
}

function formatToolArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return '';
  if (entries.length === 1) {
    const val = String(entries[0][1]);
    return val.length > 60 ? val.slice(0, 57) + '...' : val;
  }
  return entries.map(([k, v]) => {
    const val = String(v);
    return `${k}: ${val.length > 30 ? val.slice(0, 27) + '...' : val}`;
  }).join(', ');
}

// ═══════════════════════════════════════
// Non-agent mode: direct streaming (legacy)
// ═══════════════════════════════════════

async function streamDirectChat(): Promise<void> {
  const chatStore = useChatStore.getState();
  const settingsStore = useSettingsStore.getState();
  const { selectedModel, sessions, activeSessionId } = chatStore;

  const system = buildSystemPrompt();

  let actualModelId = selectedModel;
  let model = AI_MODELS[actualModelId];

  if (selectedModel === 'adaptive') {
    const session = sessions.find((s) => s.id === activeSessionId);
    const historyText = (session?.messages ?? []).slice(-10).map((m: any) => m.content).join('\n');
    const lastUserMsg = (session?.messages ?? []).filter((m: any) => m.role === 'user').pop()?.content ?? '';
    
    const result = adaptiveSelectModel(lastUserMsg, historyText + system, false);
    actualModelId = result.modelId;
    model = AI_MODELS[actualModelId];
    
    chatStore.addMessage({
      id: Date.now().toString(36),
      role: 'assistant',
      content: `🔀 **Adaptive →** ${model.label} *(${(AI_MODELS[actualModelId] as any).provider})* — ${result.reason}`,
      timestamp: Date.now(),
      model: actualModelId
    });
  }

  if (!model) {
    chatStore.addMessage({ id: Date.now().toString(36), role: 'assistant', content: 'Error: modelo no encontrado.', timestamp: Date.now() });
    return;
  }

  const apiKeys = settingsStore.apiKeys as unknown as Record<string, string>;
  const provider = model.provider;
  const providerKey = apiKeys[provider] || '';
  
  // Diagnostic: log what key we have
  console.log(`[CodeAI Chat] Modelo: ${model.label} | Provider: ${provider} | Key presente: ${providerKey ? 'SÍ (' + providerKey.slice(0, 8) + '...)' : 'NO (vacía)'}`);
  console.log(`[CodeAI Chat] Todas las keys en store:`, Object.entries(apiKeys).map(([k, v]) => `${k}: ${v ? '✅' : '❌'}`).join(', '));
  
  // If no key and model requires one, show a helpful error immediately
  if (!providerKey && !['nvidia', 'openrouter'].includes(provider)) {
    // Paid providers absolutely need a key
    chatStore.addMessage({
      id: Date.now().toString(36), role: 'assistant',
      content: `❌ No tienes configurada una API key para **${provider}**. Ve a Configuración (⚙️) → API Keys y pega tu llave de ${model.label}.`,
      timestamp: Date.now(), model: selectedModel,
    });
    return;
  }
  
  const { path, headers } = getProviderConfig(provider, apiKeys);

  const session = sessions.find((s) => s.id === activeSessionId);
  const historyMessages = (session?.messages ?? [])
    .filter((m) => m.role !== 'system')
    .slice(-20)
    .map((m: any) => ({ role: m.role, content: m.content, attachments: m.attachments, reasoning_content: m.reasoning_content }));

  const body = buildRequestBody(provider, actualModelId, historyMessages, system);

  chatStore.setStreaming(true);
  chatStore.setStreamContent('');

  try {
    const { response } = api.streamAI(path, body, headers as Record<string, string>);
    const res = await response;

    if (!res.ok) {
      const errText = await res.text();
      chatStore.addMessage({
        id: Date.now().toString(36), role: 'assistant',
        content: `Error ${res.status}: ${errText.slice(0, 200)}`,
        timestamp: Date.now(), model: selectedModel,
      });
      chatStore.setStreaming(false);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const text = parseChunk(chunk, provider);
      if (text) {
        fullContent += text;
        chatStore.setStreamContent(fullContent);
      }
    }

    chatStore.addMessage({
      id: Date.now().toString(36), role: 'assistant',
      content: fullContent || '(sin respuesta)',
      timestamp: Date.now(), model: actualModelId,
    });

    const promptTokens = Math.ceil((system.length + JSON.stringify(historyMessages).length) / 4);
    const completionTokens = Math.ceil(fullContent.length / 4);
    chatStore.incrementModelUsage(actualModelId, promptTokens + completionTokens);

    // Old-style agent processing (file blocks in markdown)
    if (chatStore.agentMode && fullContent) {
      await processAgentResponse(fullContent);
    }
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      chatStore.addMessage({
        id: Date.now().toString(36), role: 'assistant',
        content: `Error: ${e.message}`,
        timestamp: Date.now(), model: selectedModel,
      });
    }
  } finally {
    chatStore.setStreaming(false);
    chatStore.setStreamContent('');
  }
}

// ═══════════════════════════════════════
// Main export: routes to agent or direct
// ═══════════════════════════════════════

/** Main entry point — delegates to agent loop or direct streaming */
export async function streamChat(_userMessage: string): Promise<void> {
  const { agentMode } = useChatStore.getState();
  const editorState = useEditorStore.getState();

  // Use agentic loop when agent mode is ON and we have a project root
  if (agentMode && editorState.rootPath) {
    return streamAgentChat();
  }

  // Otherwise use direct streaming (legacy)
  return streamDirectChat();
}

/** Parse an SSE chunk from different providers */
function parseChunk(chunk: string, provider: AIProvider): string {
  let text = '';
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6).trim();
    if (data === '[DONE]') continue;

    try {
      const json = JSON.parse(data);

      switch (provider) {
        case 'claude':
          if (json.type === 'content_block_delta' && json.delta?.text) {
            text += json.delta.text;
          }
          break;
        case 'gemini':
          if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
            text += json.candidates[0].content.parts[0].text;
          }
          break;
        case 'openai':
        case 'deepseek':
        case 'openrouter':
        default:
          if (json.choices?.[0]?.delta?.content) {
            text += json.choices[0].delta.content;
          }
          break;
      }
    } catch {
      // skip malformed JSON
    }
  }

  return text;
}
