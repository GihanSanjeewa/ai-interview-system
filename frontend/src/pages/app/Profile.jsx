import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Lock, Mail, Save, ShieldAlert, Sparkles, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useTheme } from "@/context/ThemeContext";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Input, Label, PasswordInput } from "@/components/ui/Input";
import Switch from "@/components/ui/Switch";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    title: user?.title || "Software Engineer",
    bio: user?.bio || "Building things that mostly compile.",
  });
  const [prefs, setPrefs] = useState({
    emailUpdates: true,
    weeklyReport: true,
    smartReminders: false,
    publicProfile: false,
  });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  const setField = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateUser({ avatar: reader.result });
      toast.success("Avatar updated");
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = (e) => {
    e.preventDefault();
    updateUser({ name: form.name, email: form.email, title: form.title, bio: form.bio });
    toast.success("Profile saved");
  };

  const savePassword = (e) => {
    e.preventDefault();
    if (pw.next.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setPw({ current: "", next: "", confirm: "" });
    toast.success("Password updated");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-surface border-token rounded-3xl border p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative">
            <Avatar name={form.name || "U"} src={user?.avatar} size="xl" ring />
            <button
              onClick={() => fileRef.current?.click()}
              className="bg-brand-500 hover:bg-brand-600 absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-xl text-white shadow"
            >
              <Camera className="size-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatar}
              className="hidden"
            />
          </div>
          <div className="flex-1">
            <h1 className="font-display text-default text-2xl font-bold sm:text-3xl">
              {form.name || "Your name"}
            </h1>
            <p className="text-muted text-sm">{form.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="brand" icon={Sparkles}>
                {user?.plan || "Free"} plan
              </Badge>
              <span className="text-subtle text-xs">{form.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" leftIcon={Save} onClick={saveProfile}>
              Save changes
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile form */}
        <motion.form
          onSubmit={saveProfile}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface border-token rounded-3xl border p-6 lg:col-span-2"
        >
          <h2 className="text-default text-lg font-semibold">Edit profile</h2>
          <p className="text-muted text-xs">
            Public info that appears on shared reports.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Full name</Label>
              <Input leftIcon={User} value={form.name} onChange={setField("name")} />
            </div>
            <div>
              <Label>Email address</Label>
              <Input leftIcon={Mail} type="email" value={form.email} onChange={setField("email")} />
            </div>
            <div>
              <Label>Job title</Label>
              <Input value={form.title} onChange={setField("title")} />
            </div>
            <div className="sm:col-span-2">
              <Label>Bio</Label>
              <textarea
                value={form.bio}
                onChange={setField("bio")}
                className="bg-surface-2 border-token text-default placeholder:text-subtle min-h-[100px] w-full rounded-xl border p-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button leftIcon={Save} type="submit">
              Save changes
            </Button>
          </div>
        </motion.form>

        {/* Theme + preferences */}
        <div className="space-y-6">
          <div className="bg-surface border-token rounded-3xl border p-6">
            <h2 className="text-default text-lg font-semibold">Appearance</h2>
            <p className="text-muted text-xs">Pick how Aria looks for you.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                { v: "dark", label: "Dark", bg: "from-[#0c0c16] to-[#1a1a2e]" },
                { v: "light", label: "Light", bg: "from-[#f4f5fb] to-[#ffffff]" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => setTheme(o.v)}
                  className={`group relative rounded-2xl border p-3 text-left transition ${
                    theme === o.v
                      ? "border-brand-500/50 bg-brand-500/10"
                      : "border-token bg-surface hover:bg-surface-2"
                  }`}
                >
                  <div className={`mb-3 h-20 rounded-xl bg-gradient-to-br ${o.bg}`} />
                  <p className="text-default text-sm font-semibold">{o.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface border-token rounded-3xl border p-6">
            <h2 className="text-default text-lg font-semibold">
              Notifications
            </h2>
            <p className="text-muted text-xs">Stay informed without the noise.</p>
            <div className="mt-5 space-y-3">
              {[
                { k: "emailUpdates", label: "Product updates by email" },
                { k: "weeklyReport", label: "Weekly performance digest" },
                { k: "smartReminders", label: "Smart practice reminders" },
                { k: "publicProfile", label: "Public coaching profile" },
              ].map((p) => (
                <div
                  key={p.k}
                  className="bg-surface-2 border-token flex items-center justify-between rounded-xl border px-3 py-2.5"
                >
                  <span className="text-default text-sm">{p.label}</span>
                  <Switch
                    checked={prefs[p.k]}
                    onChange={(v) => setPrefs((s) => ({ ...s, [p.k]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Password + danger */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.form
          onSubmit={savePassword}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface border-token rounded-3xl border p-6"
        >
          <div className="flex items-center gap-3">
            <div className="from-brand-500/15 to-accent-500/15 text-brand-400 grid size-10 place-items-center rounded-xl bg-gradient-to-br">
              <Lock className="size-4.5" />
            </div>
            <div>
              <h2 className="text-default text-lg font-semibold">
                Change password
              </h2>
              <p className="text-muted text-xs">
                Use at least 8 characters with a mix of types.
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div>
              <Label>Current password</Label>
              <PasswordInput
                value={pw.current}
                onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
              />
            </div>
            <div>
              <Label>New password</Label>
              <PasswordInput
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              />
            </div>
            <div>
              <Label>Confirm new password</Label>
              <PasswordInput
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button type="submit">Update password</Button>
          </div>
        </motion.form>

        <div className="border-rose-500/30 bg-rose-500/5 rounded-3xl border p-6">
          <div className="flex items-center gap-3">
            <div className="bg-rose-500/15 text-rose-400 grid size-10 place-items-center rounded-xl">
              <ShieldAlert className="size-4.5" />
            </div>
            <h2 className="text-default text-lg font-semibold">Danger zone</h2>
          </div>
          <p className="text-muted mt-2 text-sm">
            Deleting your account erases all sessions, recordings and reports.
            This action is irreversible.
          </p>
          <div className="mt-5 flex justify-end">
            <Button variant="danger">Delete account</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
