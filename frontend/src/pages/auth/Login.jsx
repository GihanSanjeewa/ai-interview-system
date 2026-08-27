import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Input, Label, FieldError, PasswordInput } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import SocialButtons from "@/components/auth/SocialButtons";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const setField = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (form.password.length < 6) next.password = "Password must be at least 6 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back!", "Loading your AI interview studio…");
      const dest = location.state?.from?.pathname || "/app/dashboard";
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error("Login failed", err?.message || "Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-default text-2xl sm:text-3xl font-extrabold">
          Sign In to Studio
        </h1>
        <p className="text-muted mt-1.5 text-xs sm:text-sm">
          Pick up where you left off. Aria is ready for your next session.
        </p>
      </div>

      <SocialButtons />

      <div className="my-5 flex items-center gap-3">
        <span className="border-token h-px flex-1 border-t" />
        <span className="text-subtle text-[10px] font-bold uppercase tracking-widest">
          or sign in with email
        </span>
        <span className="border-token h-px flex-1 border-t" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@work-or-personal.com"
            leftIcon={Mail}
            value={form.email}
            onChange={setField("email")}
            error={errors.email}
            autoComplete="email"
          />
          <FieldError>{errors.email}</FieldError>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label htmlFor="password" className="mb-0">
              Password
            </Label>
            <Link
              to="/forgot-password"
              className="text-brand-400 hover:text-brand-300 text-xs font-semibold"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            placeholder="••••••••••••"
            value={form.password}
            onChange={setField("password")}
            autoComplete="current-password"
            error={errors.password}
          />
          <FieldError>{errors.password}</FieldError>
        </div>

        <Button type="submit" size="lg" className="w-full mt-2" loading={loading}>
          Sign In
        </Button>
      </form>

      <p className="text-muted mt-6 text-center text-xs sm:text-sm">
        Don't have an account?{" "}
        <Link to="/register" className="text-brand-400 font-bold hover:underline">
          Create one now
        </Link>
      </p>
    </div>
  );
}
