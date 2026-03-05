import { CRM } from "@/components/atomic-crm/root/CRM";
import {
  authProvider,
  dataProvider,
} from "@/components/atomic-crm/providers/fakerest";

function getBasename(): string | undefined {
  const base = import.meta.env.BASE_URL;
  if (!base || base === "/" || base === "./") return undefined;
  return base.replace(/\/$/, "");
}

const App = () => (
  <CRM
    dataProvider={dataProvider}
    authProvider={authProvider}
    basename={getBasename()}
  />
);

export default App;
