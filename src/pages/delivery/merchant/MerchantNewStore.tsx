import { useNavigate } from "react-router-dom";
import { StoreOnboarding } from "@/components/merchant/StoreOnboarding";
import { useAuth } from "@/contexts/AuthContext";
import { useMerchant } from "./context";

/** Crear otro comercio desde el panel: el mismo asistente de 7 pasos (con tienda online) que se ve al empezar. */
export default function MerchantNewStore() {
  const { user } = useAuth();
  const { reloadBranches, switchStore } = useMerchant();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div className="-mx-3 sm:-mx-5">
      <StoreOnboarding
        userId={user.id}
        onCancel={() => navigate("/app/comercio/sucursales")}
        onDone={async (storeId) => {
          await reloadBranches();
          switchStore(storeId);
          navigate("/app/comercio");
        }}
      />
    </div>
  );
}
