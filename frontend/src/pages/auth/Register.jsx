import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Input, Label, FieldError, PasswordInput } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import SocialButtons from "@/components/auth/SocialButtons";
import { cn } from "@/lib/utils";

function strengthOf(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(s, 4);
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const setField = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const strength = useMemo(() => strengthOf(form.password), [form.password]);

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = "Tell us your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email.";
    if (strength < 2) next.password = "Use 8+ chars, mix letters & numbers.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success("Account created", "Let's pick your first interview.");
      navigate("/app/dashboard", { replace: true });
    } catch (err) {
      toast.error("Sign up failed", err?.message || "Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-default text-3xl font-bold">
        Create your account
      </h1>
      <p className="text-muted mt-2 text-sm">
        Free forever. No credit card. Start with a 15-min mock.
      </p>

      <div className="mt-8">
        <SocialButtons />
        <div className="my-6 flex items-center gap-3">
          <span className="border-token h-px flex-1 border-t" />
          <span className="text-subtle text-xs font-semibold uppercase tracking-widest">
            or
          </span>
          <span className="border-token h-px flex-1 border-t" />
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            placeholder="Jane Doe"
            leftIcon={User}
            value={form.name}
            onChange={setField("name")}
            autoComplete="name"
          />
          <FieldError>{errors.name}</FieldError>
        </div>

        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            leftIcon={Mail}
            value={form.email}
            onChange={setField("email")}
            autoComplete="email"
          />
          <FieldError>{errors.email}</FieldError>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={setField("password")}
            autoComplete="new-password"
          />
          <div className="mt-2 flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i < strength
                    ? ["bg-rose-400", "bg-amber-400", "bg-amber-300", "bg-emerald-400"][strength - 1]
                    : "bg-surface-2"
                )}
              />
            ))}
          </div>
          <FieldError>{errors.password}</FieldError>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-brand-500 mt-0.5 size-4 rounded"
            defaultChecked
          />
          <span className="text-muted">
            I agree to the{" "}
            <a href="#" className="text-brand-400 font-medium">
              Terms
            </a>{" "}
            and{" "}
            <a href="#" className="text-brand-400 font-medium">
              Privacy Policy
            </a>
            .
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>

      <p className="text-muted mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link to="/login" className="text-brand-400 font-semibold">
          Sign in
        </Link>
      </p>
    </div>
  );
}
