import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Mail } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setSent(true);
      setLoading(false);
      toast.success("Reset link sent", `Check ${email} for instructions.`);
    }, 900);
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="from-emerald-400/20 to-emerald-500/5 mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br">
          <CheckCircle2 className="size-7 text-emerald-400" />
        </div>
        <h1 className="font-display text-default mt-5 text-3xl font-bold">
          Check your inbox
        </h1>
        <p className="text-muted mt-2 text-sm">
          We sent a reset link to <span className="text-default font-semibold">{email}</span>.
          The link expires in 15 minutes.
        </p>
        <Link to="/login" className="mt-8 inline-block">
          <Button variant="secondary" size="lg">
            Back to sign in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-default text-3xl font-bold">
        Forgot password?
      </h1>
      <p className="text-muted mt-2 text-sm">
        Enter your email and we'll send you a secure reset link.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            leftIcon={Mail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>

      <p className="text-muted mt-6 text-center text-sm">
        Remembered it?{" "}
        <Link to="/login" className="text-brand-400 font-semibold">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
