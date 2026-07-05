'use client';

import { useEffect, useState } from 'react';
import { formatTimeLeft } from '@/lib/format';

type View =
  | 'loading'
  | 'confirm'
  | 'payment'
  | 'partial'
  | 'confirmed'
  | 'expired'
  | 'error';

interface Order {
  id: string;
  virtualAccountName: string;
  bankName: string;
  virtualAccountNumber: string;
  amountExpected: number;
  amountPaid?: number;
  expiresAt: string;
  status: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function PayPage({
  params,
}: {
  params: { orderId: string };
}) {
  const { orderId } = params;
  const [view, setView] = useState<View>('loading');
  const [order, setOrder] = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/orders/${orderId}`);
        if (!res.ok) throw new Error('Failed to load order');
        const data: Order = await res.json();
        if (cancelled) return;

        setOrder(data);

        if (data.status === 'completed') {
          setView('confirmed');
        } else if (data.status === 'partial') {
          setView('partial');
        } else if (
          data.status === 'expired' ||
          new Date() > new Date(data.expiresAt)
        ) {
          setView('expired');
        } else {
          setView('confirm');
        }
      } catch {
        if (!cancelled) setView('error');
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const handleCopy = async () => {
    if (!order) return;
    await navigator.clipboard.writeText(order.virtualAccountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Countdown timer while on the payment or partial view
  useEffect(() => {
    if ((view !== 'payment' && view !== 'partial') || !order) return;

    const update = () => {
      const secondsLeft = Math.round(
        (new Date(order.expiresAt).getTime() - Date.now()) / 1000,
      );
      const clamped = Math.max(0, secondsLeft);
      setTimeLeft(clamped);
      if (clamped === 0) {
        setView('expired');
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [view, order?.expiresAt]);

  // Poll for payment status while on the payment or partial view
  useEffect(() => {
    if ((view !== 'payment' && view !== 'partial') || !order) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/orders/${orderId}`);
        if (!res.ok) return;
        const data: Order = await res.json();
        setOrder(data);
        if (data.status === 'completed') {
          setView('confirmed');
        } else if (data.status === 'partial') {
          setView('partial');
        }
      } catch {
        // ignore transient polling errors, retry next tick
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [view, order?.id, orderId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        {view === 'loading' && (
          <div className="flex flex-col items-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            <p className="mt-4 text-sm text-gray-500">
              Loading payment details...
            </p>
          </div>
        )}

        {view === 'confirm' && order && (
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Payment Request
            </h1>

            <p className="mt-4 text-sm text-gray-500">Merchant</p>
            <p className="text-base font-medium text-gray-900">
              {order.virtualAccountName}
            </p>

            <p className="mt-4 text-3xl font-semibold text-gray-900">
              ₦{order.amountExpected}
            </p>

            <p className="mt-4 text-sm text-gray-600">
              You are about to pay {order.virtualAccountName} ₦
              {order.amountExpected}
            </p>

            <button
              type="button"
              onClick={() => setView('payment')}
              className="mt-6 w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              Confirm & View Payment Details
            </button>
          </div>
        )}

        {view === 'payment' && order && (
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Complete your transfer
            </h1>

            <div className="mt-5 space-y-1 text-sm text-gray-700">
              <p className="font-medium">{order.bankName}</p>
              <p className="text-2xl font-bold tracking-wide text-gray-900">
                {order.virtualAccountNumber}
              </p>
              <p>{order.virtualAccountName}</p>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {copied ? 'Copied!' : 'Copy account number'}
            </button>

            <p className="mt-4 text-2xl font-semibold text-gray-900">
              ₦{order.amountExpected}
            </p>

            <p className="mt-4 text-sm text-gray-500">
              Expires in{' '}
              <span className="font-mono font-medium text-gray-900">
                {formatTimeLeft(timeLeft)}
              </span>
            </p>

            <p className="mt-6 text-sm text-gray-600">
              Open your banking app and transfer the exact amount to the
              account above
            </p>
          </div>
        )}

        {view === 'partial' && order && (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                className="h-7 w-7 text-orange-500"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>

            <h1 className="mt-4 text-xl font-semibold text-gray-900">
              Payment Incomplete
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              ₦{order.amountPaid ?? 0} received — ₦
              {order.amountExpected - (order.amountPaid ?? 0)} still needed
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Please transfer the remaining amount to the same account
            </p>

            <div className="mt-5 space-y-1 text-sm text-gray-700">
              <p className="font-medium">{order.bankName}</p>
              <p className="text-2xl font-bold tracking-wide text-gray-900">
                {order.virtualAccountNumber}
              </p>
              <p>{order.virtualAccountName}</p>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {copied ? 'Copied!' : 'Copy account number'}
            </button>

            <p className="mt-4 text-sm text-gray-500">
              Expires in{' '}
              <span className="font-mono font-medium text-gray-900">
                {formatTimeLeft(timeLeft)}
              </span>
            </p>
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
              Payment Successful!
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Your payment of ₦{order.amountExpected} has been confirmed
            </p>
            <p className="mt-4 text-sm text-gray-500">
              You can close this page
            </p>
          </div>
        )}

        {view === 'expired' && (
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Payment Window Expired
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              This payment link is no longer valid
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Please ask the merchant to generate a new one
            </p>
          </div>
        )}

        {view === 'error' && (
          <div className="text-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Unable to load payment details
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Please check your link and try again
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
