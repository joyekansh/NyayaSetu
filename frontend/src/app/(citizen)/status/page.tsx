
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import GovShell from "@/components/GovShell";

export default function StatusLandingPage() {
  const router = useRouter();
  const [caseId, setCaseId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!caseId.trim()) {
      setError("Please enter a valid Case ID.");
      return;
    }

    // Simple UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(caseId.trim())) {
      setError("Invalid Case ID format. It should look like: a0000000-0000-0000-0000-000000000000");
      return;
    }

    router.push(`/status/${caseId.trim()}`);
  }

  return (
    <GovShell>
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-slate-900">
              Track Your Legal Aid Request
            </h3>
            <div className="mt-2 max-w-xl text-sm text-slate-500">
              <p>Enter the Case ID you received when you submitted your request to check its real-time status.</p>
            </div>
            <form className="mt-5 sm:flex sm:items-center" onSubmit={handleSubmit}>
              <div className="w-full sm:max-w-xs">
                <label htmlFor="caseId" className="sr-only">
                  Case ID
                </label>
                <input
                  type="text"
                  name="caseId"
                  id="caseId"
                  className="shadow-sm focus:ring-gov-blue focus:border-gov-blue block w-full sm:text-sm border-slate-300 rounded-md p-2 border"
                  placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm font-medium rounded-md text-white bg-gov-blue hover:bg-gov-blue-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gov-blue sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Track Status
              </button>
            </form>
            {error && (
              <p className="mt-2 text-sm text-red-600" id="case-error">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </GovShell>
  );
}
