import GovShell from "@/components/GovShell";
import Link from "next/link";

const SCHEMES = [
  {
    id: "nalsa-legal-aid",
    title: "Free Legal Services (LSA Act, 1987)",
    description: "Provides free legal representation, drafting of documents, and consultation to marginalized sections including women, children, SC/ST, and industrial workmen.",
    eligibility: "Women, children, SC/ST community members, victims of trafficking, industrial workmen, and persons with annual income below ₹3 Lakhs (varies by state).",
  },
  {
    id: "nalsa-compensation",
    title: "Victim Compensation Scheme",
    description: "Financial assistance and rehabilitation support for victims of crimes such as acid attacks, sexual assault, and trafficking.",
    eligibility: "Victims of specified crimes who have suffered loss or injury and require rehabilitation.",
  },
  {
    id: "nalsa-lok-adalat",
    title: "Lok Adalat & Dispute Resolution",
    description: "Alternative dispute resolution mechanism to settle pending court cases or pre-litigation disputes amicably without formal court trials.",
    eligibility: "Any citizen with a compoundable criminal offense or civil dispute.",
  }
];

export default function SchemesPage() {
  return (
    <GovShell>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Legal Aid Schemes</h1>
          <p className="mt-2 text-lg text-slate-600">
            The Government of India and NALSA provide several statutory schemes to ensure justice is accessible to all.
          </p>
        </div>

        <div className="space-y-6">
          {SCHEMES.map((scheme) => (
            <div key={scheme.id} className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-slate-900">
                  {scheme.title}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  {scheme.description}
                </p>
              </div>
              <div className="border-t border-slate-200 px-4 py-5 sm:p-0">
                <dl className="sm:divide-y sm:divide-slate-200">
                  <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-slate-500">
                      Eligibility Criteria
                    </dt>
                    <dd className="mt-1 text-sm text-slate-900 sm:mt-0 sm:col-span-2">
                      {scheme.eligibility}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="bg-slate-50 px-4 py-4 sm:px-6">
                <Link
                  href="/upload"
                  className="text-sm font-medium text-gov-blue hover:text-gov-blue-dark"
                >
                  Apply for this scheme <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GovShell>
  );
}
