'use client';

import Link from 'next/link';
import { ServiceTiles } from '@/components/GovShell';

export default function HomePage() {
  return (
    <div className="space-y-12 animate-fade-in">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#00266B] to-[#0047AB] px-6 py-16 text-center text-white shadow-xl sm:px-12 sm:py-24">
        <div className="relative z-10 mx-auto max-w-3xl space-y-6">
          <span className="inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-blue-100 backdrop-blur-md border border-white/20 uppercase">
            Ministry of Law & Justice
          </span>
          <h1 className="font-heading text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl text-white tracking-tight">
            Access to Justice for All
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-blue-50 sm:text-xl leading-relaxed opacity-90">
            NyayaSetu is a national platform that helps citizens identify legal aid schemes they qualify for. Upload your documents, describe your grievance, and receive guidance on government support.
          </p>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/upload"
              className="w-full sm:w-auto rounded-xl bg-white px-8 py-4 text-base font-semibold text-gov-blue-dark shadow-sm transition-all hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-white/30"
            >
              File a Legal Request
            </Link>
            <Link
              href="/status"
              className="w-full sm:w-auto rounded-xl border border-white/30 bg-transparent px-8 py-4 text-base font-semibold text-white transition-all hover:bg-white/10 focus:outline-none focus:ring-4 focus:ring-white/30"
            >
              Track Case Status
            </Link>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="grid gap-8 sm:grid-cols-3">
        <div className="rounded-2xl border border-gov-border/60 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
          <h3 className="mb-3 font-heading text-xl font-semibold text-gov-blue-dark">Data Privacy & Compliance</h3>
          <p className="text-sm leading-relaxed text-gov-text-muted">
            All submitted documents and personal details are processed securely in strict accordance with the DPDP Act 2023. No data is shared with third parties.
          </p>
        </div>
        <div className="rounded-2xl border border-gov-border/60 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
          <h3 className="mb-3 font-heading text-xl font-semibold text-gov-blue-dark">Automated Case Analysis</h3>
          <p className="text-sm leading-relaxed text-gov-text-muted">
            The platform utilizes optical character recognition (OCR) and text analysis to read official notices and accurately map them to relevant law clauses.
          </p>
        </div>
        <div className="rounded-2xl border border-gov-border/60 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
          <h3 className="mb-3 font-heading text-xl font-semibold text-gov-blue-dark">DLSA Integration</h3>
          <p className="text-sm leading-relaxed text-gov-text-muted">
            Approved requests are routed directly to the appropriate District Legal Services Authorities (DLSA) and verified pro-bono lawyers for further action.
          </p>
        </div>
      </section>

      {/* Divider */}
      <hr className="border-gov-border/60" />

      {/* Grid of Gov Services */}
      <ServiceTiles lang="en" />
    </div>
  );
}
