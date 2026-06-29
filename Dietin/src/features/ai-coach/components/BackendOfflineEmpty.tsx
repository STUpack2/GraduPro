import { Sparkles, Terminal } from "lucide-react";

export function BackendOfflineEmpty() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 p-6 text-center max-w-md mx-auto">
      <div className="bg-white/60 dark:bg-bg-card p-3 rounded-full inline-flex mb-3">
        <Sparkles className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Coach</h2>
      <p className="text-sm text-gray-600 dark:text-text-muted mt-1">
        Real-time exercise classification and rep counting via your webcam.
      </p>
      <div className="mt-4 text-left text-xs bg-black/80 text-emerald-300 font-mono rounded-xl p-3 overflow-x-auto">
        <div className="flex items-center gap-1.5 mb-2 text-white/60">
          <Terminal className="h-3 w-3" />
          <span>Start the local server</span>
        </div>
        <pre className="whitespace-pre">{`cd Dietin/ai/exercise_recognition
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd inference
uvicorn app.api:app --host 0.0.0.0 --port 8000`}</pre>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Then reload this page — the AI Coach will come online automatically.
      </p>
    </div>
  );
}
