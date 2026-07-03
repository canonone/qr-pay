'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { formatTimeLeft } from '@/lib/format';

type View = 'form' | 'qr' | 'confirmed';

interface Order {
  id: string;
  virtualAccountNumber: string;
  virtualAccountName: string;
  bankName: string;
  amountExpected: number;
  expiresAt: string;
  status: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const [view, setView] = useState<View>('form');
  const [amountExpected, setAmountExpected] = useState('');
  const [merchantRef, setMerchantRef] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountExpected: Number(amountExpected),
          merchantRef,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create order');
      }

      setOrder(data);
      setView('qr');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setView('form');
    setAmountExpected('');
    setMerchantRef('');
    setOrder(null);
    setError(null);
    setTimeLeft(0);
  };

  const handleCopyLink = async () => {
    if (!order) return;
    const link = `${window.location.origin}/pay/${order.id}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Countdown timer based on order.expiresAt
  useEffect(() => {
    if (view !== 'qr' || !order) return;

    const update = () => {
      const secondsLeft = Math.round(
        (new Date(order.expiresAt).getTime() - Date.now()) / 1000,
      );
      setTimeLeft(Math.max(0, secondsLeft));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [view, order?.expiresAt]);

  // Poll for payment status
  useEffect(() => {
    if (view !== 'qr' || !order) return;

    const orderId = order.id;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/orders/${orderId}`);
        if (!res.ok) return;
        const data: Order = await res.json();
        setOrder(data);
        if (data.status === 'completed') {
          setView('confirmed');
        }
      } catch {
        // ignore transient polling errors, retry next tick
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [view, order?.id]);

  const expired = view === 'qr' && timeLeft <= 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        {view === 'form' && (
          <>
            <h1 className="text-center text-2xl font-semibold text-gray-900">
              QR Pay
            </h1>
            <p className="mt-1 text-center text-sm text-gray-500">
              Create a payment request
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-gray-700"
                >
                  Amount (NGN)
                </label>
                <input
                  id="amount"
                  type="number"
                  min={1}
                  required
                  value={amountExpected}
                  onChange={(e) => setAmountExpected(e.target.value)}
                  placeholder="1000"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="merchantRef"
                  className="block text-sm font-medium text-gray-700"
                >
                  Payment reference
                </label>
                <input
                  id="merchantRef"
                  type="text"
                  required
                  value={merchantRef}
                  onChange={(e) => setMerchantRef(e.target.value)}
                  placeholder="Invoice #001"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-900 focus:outline-none"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {loading ? 'Generating…' : 'Generate QR Code'}
              </button>
            </form>
          </>
        )}

        {view === 'qr' && order && (
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Awaiting Payment
            </h1>

            <div className="mt-5 flex justify-center">
              <QRCodeSVG
                value={`${window.location.origin}/pay/${order.id}`}
                size={200}
              />
            </div>

            <div className="mt-5 space-y-1 text-sm text-gray-700">
              <p className="font-medium">{order.bankName}</p>
              <p className="text-lg font-semibold tracking-wide text-gray-900">
                {order.virtualAccountNumber}
              </p>
              <p>{order.virtualAccountName}</p>
            </div>

            <p className="mt-4 text-2xl font-semibold text-gray-900">
              ₦{order.amountExpected}
            </p>

            <div className="mt-4">
              {expired ? (
                <p className="text-sm font-medium text-red-600">
                  Payment window expired
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  Expires in{' '}
                  <span className="font-mono font-medium text-gray-900">
                    {formatTimeLeft(timeLeft)}
                  </span>
                </p>
              )}
            </div>

            <div className="mt-6 border-t border-gray-200 pt-4">
              <p className="text-xs text-gray-500">Or share payment link</p>
              <button
                type="button"
                onClick={handleCopyLink}
                className="mt-2 w-full truncate rounded-lg border border-gray-300 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                {copied
                  ? 'Copied!'
                  : `${typeof window !== 'undefined' ? window.location.origin : ''}/pay/${order.id}`}
              </button>
            </div>
          </div>
        )}

        {view === 'confirmed' && order && (
          <div className="text-center">
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

            <h1 className="mt-4 text-xl font-semibold text-gray-900">
              Payment Confirmed!
            </h1>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              ₦{order.amountExpected}
            </p>
            <p className="text-sm text-gray-500">Amount received</p>

            <button
              type="button"
              onClick={handleCreateNew}
              className="mt-6 w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              Create new payment
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
