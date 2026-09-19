

const OFFICES = [
  {
    name: "National Legal Services Authority (NALSA)",
    address: "Jaisalmer House, 26, Man Singh Road, New Delhi-110011",
    phone: "15100 (National Toll-Free Helpline)",
    email: "nalsa-dla@nic.in",
    website: "https://nalsa.gov.in/"
  },
  {
    name: "Supreme Court Legal Services Committee",
    address: "108, Lawyers Chambers, Supreme Court Compound, New Delhi-110001",
    phone: "011-23388313",
    email: "sclsc@nic.in",
    website: "http://www.sclsc.nic.in/"
  },
  {
    name: "Delhi State Legal Services Authority (DSLSA)",
    address: "Central Office, Patiala House Courts Complex, New Delhi-110001",
    phone: "1516 (State Helpline)",
    email: "dslsa-phc@nic.in",
    website: "http://dslsa.org/"
  }
];

export default function ContactPage() {
  return (
    <>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Contact DLSA</h1>
          <p className="mt-2 text-lg text-slate-600">
            Get in touch with the National Legal Services Authority or your local State/District Legal Services Authority for immediate assistance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {OFFICES.map((office, idx) => (
            <div key={idx} className="bg-white shadow overflow-hidden sm:rounded-lg">
              <div className="px-4 py-5 sm:px-6 bg-slate-50 border-b border-slate-200">
                <h3 className="text-lg leading-6 font-medium text-slate-900">
                  {office.name}
                </h3>
              </div>
              <div className="px-4 py-5 sm:p-6 space-y-4">
                <div className="flex items-start">
                  <span className="text-xl mr-3" aria-hidden="true">📍</span>
                  <span className="text-sm text-slate-600">{office.address}</span>
                </div>
                <div className="flex items-start">
                  <span className="text-xl mr-3" aria-hidden="true">📞</span>
                  <span className="text-sm font-medium text-gov-blue">{office.phone}</span>
                </div>
                <div className="flex items-start">
                  <span className="text-xl mr-3" aria-hidden="true">✉️</span>
                  <span className="text-sm text-slate-600">{office.email}</span>
                </div>
                {office.website && (
                  <div className="flex items-start">
                    <span className="text-xl mr-3" aria-hidden="true">🌐</span>
                    <a href={office.website} target="_blank" rel="noopener noreferrer" className="text-sm text-gov-blue hover:underline">
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
