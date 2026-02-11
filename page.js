"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function GuildSettings({ params }) {
  const { id } = params;
  const { data: session } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/guild/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      });
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/guild/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      alert("Settings saved successfully!");
    }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen bg-discord-black flex items-center justify-center">Loading Settings...</div>;

  return (
    <div className="min-h-screen bg-discord-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.back()} className="mb-6 text-discord hover:underline">← Back to Dashboard</button>
        <h1 className="text-3xl font-bold mb-8">Server Settings - {id}</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6 bg-discord-dark p-8 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Prefix</label>
            <input
              type="text"
              value={settings.prefix}
              onChange={(e) => setSettings({ ...settings, prefix: e.target.value })}
              className="w-full bg-discord-black border border-gray-600 rounded p-2 focus:border-discord outline-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">XP System</h3>
              <p className="text-sm text-gray-400">Enable or disable the leveling system</p>
            </div>
            <input
              type="checkbox"
              checked={settings.xpSystem}
              onChange={(e) => setSettings({ ...settings, xpSystem: e.target.checked })}
              className="w-6 h-6 accent-discord"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Welcome Channel ID</label>
            <input
              type="text"
              value={settings.welcomeChannel || ""}
              onChange={(e) => setSettings({ ...settings, welcomeChannel: e.target.value })}
              className="w-full bg-discord-black border border-gray-600 rounded p-2 focus:border-discord outline-none"
              placeholder="e.g. 123456789012345678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Logs Channel ID</label>
            <input
              type="text"
              value={settings.logChannel || ""}
              onChange={(e) => setSettings({ ...settings, logChannel: e.target.value })}
              className="w-full bg-discord-black border border-gray-600 rounded p-2 focus:border-discord outline-none"
              placeholder="e.g. 123456789012345678"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-discord hover:bg-opacity-90 text-white font-bold py-3 rounded transition-all disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
