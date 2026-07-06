'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatTimeLeft } from '@/lib/format';

type View = 'setup' | 'active' | 'creating-session';

interface Counter {
  id: string;
  counterName: string;
}

interface Session {
  paymentCode: string;
  amountExpected: number;
  virtualAccountNumber: string;
  expiresAt: string;
  orderId: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function CounterManagePage() {
  const [view, setView] = useState<View>('setup');
  const [counterName, setCounterName] = useState('');
  const [counter, setCounter] = useState<Counter | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState('pending');
  const [amountPaid, setAmountPaid] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const handleCreateCounter = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/counters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counterName }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create counter');
      }

      setCounter(data);
      setQrUrl(`${window.location.origin}/counter/${data.id}`);
      setView('active');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!counter) return;
    setError(null);
    setView('creating-session');

    try {
      const res = await fetch(`${API_URL}/counters/${counter.id}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountExpected: Number(amount) }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to generate code');
      }

      setSession({
        paymentCode: data.paymentCode,
        amountExpected: data.amountExpected,
        virtualAccountNumber: data.virtualAccountNumber,
        expiresAt: data.expiresAt,
        orderId: data.id,
      });
      setOrderStatus('pending');
      setAmountPaid(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setView('active');
    }
  };

  const handleNewCode = () => {
    setSession(null);
    setAmount('');
    setError(null);
    setOrderStatus('pending');
    setAmountPaid(0);
    setTimeLeft(0);
  };

  // Countdown timer for the active session
  useEffect(() => {
    if (!session || orderStatus === 'completed' || orderStatus === 'expired') {
      return;
    }

    const update = () => {
      const secondsLeft = Math.round(
        (new Date(session.expiresAt).getTime() - Date.now()) / 1000,
      );
      const clamped = Math.max(0, secondsLeft);
      setTimeLeft(clamped);
      if (clamped === 0) {
        setOrderStatus('expired');
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [session?.expiresAt, orderStatus]);

  // Poll for payment status while the session is active
  useEffect(() => {
    if (!session || orderStatus === 'completed' || orderStatus === 'expired') {
      return;
    }

    const orderId = session.orderId;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/orders/${orderId}`);
        if (!res.ok) return;
        const data = await res.json();
        setOrderStatus(data.status);
        setAmountPaid(Number(data.amountPaid ?? 0));
      } catch {
        // ignore transient polling errors, retry next tick
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [session?.orderId, orderStatus]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        {view === 'setup' && (
          <>
            <h1 className="text-center text-2xl font-semibold text-gray-900">
              Counter Setup
            </h1>

            <form onSubmit={handleCreateCounter} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="counterName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Counter name
                </label>
                <input
                  id="counterName"
                  type="text"
                  required
                  value={counterName}
                  onChange={(e) => setCounterName(e.target.value)}
                  placeholder="Front Register"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create Counter'}
              </button>
            </form>
          </>
        )}

        {(view === 'active' || view === 'creating-session') && counter && (
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900">
              {counter.counterName}
            </h1>

            <div className="mt-5 flex justify-center">
              <QRCodeSVG value={qrUrl} size={180} />
            </div>

            {session && orderStatus === 'completed' ? (
              <div className="mt-6">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    className="h-7 w-7 text-green-600"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </div>

                <h2 className="mt-4 text-lg font-semibold text-gray-900">
                  Payment Received!
                </h2>
                <p className="mt-2 text-2xl font-semibold text-gray-900">
                  ₦{session.amountExpected} confirmed
                </p>

                <button
                  type="button"
                  onClick={handleNewCode}
                  className="mt-6 w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
                >
                  Generate New Code
                </button>
              </div>
            ) : session && orderStatus === 'expired' ? (
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Session expired
                </h2>

                <button
                  type="button"
                  onClick={handleNewCode}
                  className="mt-4 w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
                >
                  Generate New Code
                </button>
              </div>
            ) : session ? (
              <div className="mt-6">
                <p className="text-sm text-gray-500">Payment Code</p>
                <p className="mt-1 text-4xl font-bold tracking-widest text-gray-900">
                  {session.paymentCode}
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Customer uses this code after scanning the QR
                </p>

                <div className="mt-4 space-y-1 rounded-lg bg-gray-50 p-3 text-left text-sm text-gray-700">
                  <p>Amount: ₦{session.amountExpected}</p>
                  <p>Account: {session.virtualAccountNumber}</p>
                  <p>
                    Expires: {new Date(session.expiresAt).toLocaleTimeString()}
                  </p>
                </div>

                {orderStatus === 'partial' && (
                  <div className="mt-4 rounded-lg bg-orange-50 p-3 text-left text-sm text-orange-700">
                    <p>⚠ Partial payment received</p>
                    <p>
                      ₦{amountPaid} of ₦{session.amountExpected} received
                    </p>
                  </div>
                )}

                <p className="mt-4 text-sm text-gray-500">
                  Expires in{' '}
                  <span className="font-mono font-medium text-gray-900">
                    {formatTimeLeft(timeLeft)}
                  </span>
                </p>

                {error && (
                  <p className="mt-3 text-sm text-red-600">{error}</p>
                )}

                <button
                  type="button"
                  onClick={handleNewCode}
                  className="mt-4 w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
                >
                  Generate New Code
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleGenerateCode}
                className="mt-6 space-y-4 text-left"
              >
                <div>
                  <label
                    htmlFor="sessionAmount"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Session Amount (NGN)
                  </label>
                  <input
                    id="sessionAmount"
                    type="number"
                    min={1}
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1000"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={view === 'creating-session'}
                  className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                >
                  {view === 'creating-session'
                    ? 'Generating…'
                    : 'Generate Payment Code'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
