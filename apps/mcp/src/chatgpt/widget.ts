/**
 * ChatGPT App Directory Widget
 *
 * Returns self-contained HTML for rendering DebateKit debate results
 * inside the ChatGPT iframe widget. Uses the MCP Apps bridge (JSON-RPC 2.0
 * via postMessage) to receive tool results.
 */

export function getWidgetHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DebateKit Debate Results</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      line-height: 1.6;
      padding: 16px;
      min-height: 100vh;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      gap: 12px;
      color: #a3a3a3;
    }

    .loading-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #262626;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .container { max-width: 720px; margin: 0 auto; }

    .header {
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #262626;
    }

    .header h1 {
      font-size: 18px;
      font-weight: 600;
      color: #f5f5f5;
      margin-bottom: 4px;
    }

    .header .subtitle {
      font-size: 13px;
      color: #737373;
    }

    .moderator-section {
      background: linear-gradient(135deg, #1e1b4b 0%, #172554 100%);
      border: 1px solid #312e81;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .moderator-section .label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #818cf8;
      margin-bottom: 8px;
    }

    .moderator-section .summary {
      font-size: 14px;
      color: #e0e7ff;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .participants-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }

    @media (min-width: 520px) {
      .participants-grid { grid-template-columns: 1fr 1fr; }
    }

    .participant-card {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 10px;
      padding: 16px;
      transition: border-color 0.15s;
    }

    .participant-card:hover { border-color: #404040; }

    .participant-card .model-name {
      font-size: 13px;
      font-weight: 600;
      color: #d4d4d4;
      margin-bottom: 2px;
    }

    .participant-card .role {
      font-size: 11px;
      color: #6366f1;
      margin-bottom: 10px;
    }

    .participant-card .response {
      font-size: 13px;
      color: #a3a3a3;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 200px;
      overflow-y: auto;
    }

    .metadata-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 12px;
      color: #525252;
      padding-top: 12px;
      border-top: 1px solid #1a1a1a;
    }

    .metadata-bar .meta-item { display: flex; align-items: center; gap: 4px; }

    .thread-link {
      display: inline-block;
      margin-top: 12px;
      font-size: 13px;
      color: #818cf8;
      text-decoration: none;
    }

    .thread-link:hover { text-decoration: underline; }

    .json-fallback {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 10px;
      padding: 16px;
      overflow-x: auto;
    }

    .json-fallback pre {
      font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #a3a3a3;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="container">
    <div id="loading" class="loading">
      <div class="loading-spinner"></div>
      <span>Waiting for results...</span>
    </div>
    <div id="content" style="display: none;"></div>
  </div>

  <script>
    (function () {
      var loadingEl = document.getElementById('loading');
      var contentEl = document.getElementById('content');

      function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      }

      function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.slice(0, len) + '...' : str;
      }

      function renderDebateResult(data) {
        var html = '';

        // Header
        html += '<div class="header">';
        html += '<h1>DebateKit Debate Results</h1>';
        if (data.metadata) {
          var parts = [];
          if (data.metadata.mode) parts.push(data.metadata.mode);
          if (data.metadata.duration_ms) parts.push(Math.round(data.metadata.duration_ms / 1000) + 's');
          if (parts.length) html += '<div class="subtitle">' + escapeHtml(parts.join(' | ')) + '</div>';
        }
        html += '</div>';

        // Moderator synthesis
        if (data.moderator && data.moderator.summary) {
          html += '<div class="moderator-section">';
          html += '<div class="label">Moderator Synthesis</div>';
          html += '<div class="summary">' + escapeHtml(data.moderator.summary) + '</div>';
          html += '</div>';
        }

        // Participant cards
        if (data.participants && data.participants.length > 0) {
          html += '<div class="participants-grid">';
          data.participants.forEach(function (p) {
            html += '<div class="participant-card">';
            html += '<div class="model-name">' + escapeHtml(p.model_name || p.modelName || 'Unknown Model') + '</div>';
            var role = p.role || p.roleName || '';
            if (role) html += '<div class="role">' + escapeHtml(role) + '</div>';
            html += '<div class="response">' + escapeHtml(truncate(p.response || '', 800)) + '</div>';
            html += '</div>';
          });
          html += '</div>';
        }

        // Metadata bar
        if (data.metadata) {
          html += '<div class="metadata-bar">';
          if (data.metadata.total_credits_used != null) {
            html += '<span class="meta-item">' + data.metadata.total_credits_used + ' credits</span>';
          }
          if (data.metadata.duration_ms != null) {
            html += '<span class="meta-item">' + (data.metadata.duration_ms / 1000).toFixed(1) + 's</span>';
          }
          if (data.metadata.mode) {
            html += '<span class="meta-item">' + escapeHtml(data.metadata.mode) + '</span>';
          }
          html += '</div>';
        }

        // Thread link
        if (data.thread_url) {
          html += '<a class="thread-link" href="' + escapeHtml(data.thread_url) + '" target="_blank" rel="noopener noreferrer">View in DebateKit app &rarr;</a>';
        }

        return html;
      }

      function renderJsonFallback(data) {
        return '<div class="json-fallback"><pre>' + escapeHtml(JSON.stringify(data, null, 2)) + '</pre></div>';
      }

      function renderResult(params) {
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';

        var data = params;

        // If the data has structured content from a debate tool, use the rich renderer
        if (data && data.structuredContent) {
          data = data.structuredContent;
        }

        if (data && (data.participants || data.moderator)) {
          contentEl.innerHTML = renderDebateResult(data);
        } else {
          contentEl.innerHTML = renderJsonFallback(data);
        }
      }

      // MCP Apps bridge (JSON-RPC 2.0 via postMessage)
      window.addEventListener('message', function (event) {
        if (event.source !== window.parent) return;
        var msg = event.data;
        if (!msg || msg.jsonrpc !== '2.0') return;

        if (msg.method === 'ui/initialize') {
          window.parent.postMessage({
            jsonrpc: '2.0',
            method: 'ui/notifications/initialized'
          }, '*');
        }

        if (msg.method === 'ui/notifications/tool-result') {
          renderResult(msg.params);
        }
      });
    })();
  </script>
</body>
</html>`;
}
