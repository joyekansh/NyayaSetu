

const FAQS = [
  {
    question: "Who is eligible for free legal aid in India?",
    answer: "Under Section 12 of the Legal Services Authorities Act, 1987, women, children, members of SC/ST, industrial workmen, victims of mass disaster, violence, flood, drought, earthquake, industrial disaster, and persons with an annual income less than the amount prescribed by the respective State Government are eligible for free legal aid."
  },
  {
    question: "Is the legal aid completely free?",
    answer: "Yes. For eligible persons, the legal services are provided entirely free of cost. This includes the payment of court fees, process fees, drafting of legal documents, and providing a legal practitioner for representation."
  },
  {
    question: "How does this portal work?",
    answer: "You can upload a document (like an FIR, legal notice, or handwritten application) or type your grievance in English or Hindi. Our AI system will extract the necessary details, determine the urgency, and route it to the appropriate District Legal Services Authority (DLSA)."
  },
  {
    question: "What documents do I need to apply?",
    answer: "You should provide any document related to your dispute (e.g., FIR, court summons, eviction notice, termination letter). You will also eventually need an income certificate or proof of belonging to an eligible category (like an SC/ST certificate) during the physical verification stage."
  }
];

export default function FAQPage() {
  return (
    <>
      <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Frequently Asked Questions</h1>
        
        <dl className="space-y-6">
          {FAQS.map((faq, index) => (
            <div key={index} className="bg-white px-4 py-5 shadow sm:rounded-lg sm:p-6">
              <dt className="text-lg font-medium text-slate-900">
                {faq.question}
              </dt>
              <dd className="mt-2 text-base text-slate-500">
                {faq.answer}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}
