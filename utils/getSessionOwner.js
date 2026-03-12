export function getSessionOwner(req) {
  if (req.session?.admin?.id) {
    return { ownerType: "admin", ownerId: Number(req.session.admin.id) };
  }

  if (req.session?.n1?.id) {
    return { ownerType: "n1", ownerId: Number(req.session.n1.id) };
  }

  if (req.session?.n2?.id) {
    return { ownerType: "n2", ownerId: Number(req.session.n2.id) };
  }

  if (req.session?.monitoramento?.id) {
    return { ownerType: "monitoramento", ownerId: Number(req.session.monitoramento.id) };
  }

  return null;
}