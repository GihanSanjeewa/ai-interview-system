import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Lock, Mail, Save, ShieldAlert, Sparkles, User, UserCheck, Zap } from "lucide-react";
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
    name: user?.name || user?.fullName || "Candidate",
    email: user?.email || "",
    title: user?.title || "Full Stack Engineer",
    bio: user?.bio || "Preparing for senior engineering interview loops.",
  });
  const [prefs, setPrefs] = useState({
    emailUpdates: true,
    weeklyReport: true,
    smartReminders: true,
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
      toast.success("Avatar Updated", "Your candidate photo was saved.");
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = (e) => {
    e.preventDefault();
    updateUser({ name: form.name, fullName: form.name, email: form.email, title: form.title, bio: form.bio });
    toast.success("Profile Saved", "Candidate details updated successfully.");
  };

  const savePassword = (e) => {
    e.preventDefault();
    if (pw.next.length < 8) {
      toast.error("Password Length", "Use at least 8 characters.");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("Password Mismatch", "Passwords do not match.");
      return;
    }
    setPw({ current: "", next: "", confirm: "" });
    toast.success("Password Updated", "Your password has been changed.");
  };

  return (
    <div className="space-y-8">
      {/* Header Profile Card */}
      <div className="glass-card rounded-3xl border border-token p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative">
            <Avatar name={form.name || "Candidate"} src={user?.avatar} size="xl" ring />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="bg-brand-500 hover:bg-brand-600 absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-xl text-white shadow-lg transition cursor-pointer"
              aria-label="Upload photo"
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

          <div className="flex-1 min-w-[200px]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand" icon={UserCheck} size="xs">
                Verified Candidate Profile
              </Badge>
              <Badge variant="success" size="xs">
                Active Interview Loop
              </Badge>
            </div>
            <h1 className="font-display text-default text-2xl sm:text-3xl font-extrabold mt-2">
              {form.name || "Candidate Name"}
            </h1>
            <p className="text-muted text-xs sm:text-sm mt-0.5">{form.title}</p>
            <p className="text-subtle text-xs mt-1">{form.email}</p>
          </div>

          <div>
            <Button leftIcon={Save} onClick={saveProfile} className="shadow-md">
              Save Profile
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Form */}
        <motion.form
          onSubmit={saveProfile}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl border border-token p-6 sm:p-7 lg:col-span-2 space-y-4"
        >
          <div className="border-b border-token pb-4">
            <h2 className="font-display text-default text-lg font-bold">Candidate Information</h2>
            <p className="text-muted text-xs mt-0.5">
              Personal information and role aspirations used for tailoring interview prompts.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            <div className="sm:col-span-2">
              <Label>Full Name</Label>
              <Input leftIcon={User} value={form.name} onChange={setField("name")} />
            </div>
            <div>
              <Label>Email Address</Label>
              <Input leftIcon={Mail} type="email" value={form.email} onChange={setField("email")} />
            </div>
            <div>
              <Label>Target Job Title / Domain</Label>
              <Input value={form.title} onChange={setField("title")} />
            </div>
            <div className="sm:col-span-2">
              <Label>Candidate Bio & Focus Areas</Label>
              <textarea
                value={form.bio}
                onChange={setField("bio")}
                className="bg-surface-2 border border-token text-default placeholder:text-subtle min-h-[110px] w-full rounded-2xl p-3.5 text-xs sm:text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <Button leftIcon={Save} type="submit">
              Save Changes
            </Button>
          </div>
        </motion.form>

        {/* Theme Appearance & Notifications */}
        <div className="space-y-6">
          <div className="glass-card rounded-3xl border border-token p-6 sm:p-7">
            <h2 className="font-display text-default text-base font-bold">Studio Theme</h2>
            <p className="text-muted text-xs mt-0.5">Switch between dark mode and clean light theme.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { v: "dark", label: "Dark Obsidian", bg: "from-[#0c0d18] to-[#1a1c33]" },
                { v: "light", label: "Light Clean", bg: "from-[#f1f5f9] to-[#ffffff]" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setTheme(o.v)}
                  className={`group rounded-2xl border p-3 text-left transition cursor-pointer ${
                    theme === o.v
                      ? "border-brand-500 bg-brand-500/10 shadow-sm"
                      : "border-token bg-surface hover:bg-surface-2"
                  }`}
                >
                  <div className={`mb-2.5 h-16 rounded-xl bg-gradient-to-br ${o.bg} border border-token`} />
                  <p className="text-default text-xs font-bold">{o.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-token p-6 sm:p-7">
            <h2 className="font-display text-default text-base font-bold">Preferences</h2>
            <p className="text-muted text-xs mt-0.5">Manage session notifications & reminders.</p>
            <div className="mt-4 space-y-2.5">
              {[
                { k: "emailUpdates", label: "Interview report digests" },
                { k: "weeklyReport", label: "Weekly skill breakdown" },
                { k: "smartReminders", label: "Practice pace reminders" },
              ].map((p) => (
                <div
                  key={p.k}
                  className="bg-surface-2 border border-token flex items-center justify-between rounded-xl px-3.5 py-2.5"
                >
                  <span className="text-default text-xs font-semibold">{p.label}</span>
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

      {/* Password Management & Danger Zone */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.form
          onSubmit={savePassword}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl border border-token p-6 sm:p-7 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400 border border-brand-500/30">
              <Lock className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-default text-base font-bold">
                Security & Password
              </h2>
              <p className="text-muted text-xs">
                Update your account password with at least 8 characters.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <Label>Current Password</Label>
              <PasswordInput
                value={pw.current}
                onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                placeholder="Current password"
              />
            </div>
            <div>
              <Label>New Password</Label>
              <PasswordInput
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                placeholder="New password (min 8 chars)"
              />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <PasswordInput
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                placeholder="Re-enter new password"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" size="sm">Update Password</Button>
          </div>
        </motion.form>

        <div className="glass-card rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                <ShieldAlert className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-default text-base font-bold">Danger Zone</h2>
                <p className="text-muted text-xs">Irreversible account actions.</p>
              </div>
            </div>
            <p className="text-muted text-xs sm:text-sm mt-4 leading-relaxed">
              Deleting your candidate account will permanently purge all uploaded resumes,
              recorded interview sessions, transcripts, audio data, and feedback reports.
            </p>
          </div>

          <div className="mt-6 flex justify-end">
            <Button variant="danger" size="sm">
              Delete Candidate Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
