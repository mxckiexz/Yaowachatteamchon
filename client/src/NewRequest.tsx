import { useNavigate } from "react-router-dom";
import { createRequest } from "./api";
import RequestForm, { EMPTY_FORM } from "./RequestForm";

export default function NewRequest() {
  const navigate = useNavigate();
  return (
    <>
      <h1 className="h4 mb-3">New purchase request</h1>
      <RequestForm
        initial={EMPTY_FORM}
        submitLabel="Save draft"
        busyLabel="Saving..."
        onSave={async (input) => {
          const result = await createRequest(input);
          navigate(`/requests/${result.request.id}`);
        }}
      />
    </>
  );
}
