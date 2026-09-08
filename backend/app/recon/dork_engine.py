"""Motor de dork genérico — combina nome/e-mail/telefone/username/domínio/
extensão de arquivo em queries pré-configuradas. Mesmo princípio de
`dork_generator.py` (domínio) e `phone_mentions.py`: gera a busca certa, não
faz scraping do resultado — o investigador roda no buscador e revisa
manualmente.

Templates específicos por tipo de campo (2026-09-08): nome se beneficia de
dork de rede social/currículo/registro público; e-mail/telefone/username se
beneficiam de dork de vazamento (paste site, credencial exposta) — juntar
tudo num template genérico único desperdiçava sinal.
"""

from dataclasses import dataclass

COMMON_DOC_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt"]

# {subject} vira o valor entre aspas; {scope} vira "site:dominio " ou "" (já com espaço/vazio).
NAME_TEMPLATES = [
    ('{scope}"{subject}" site:linkedin.com/in/', "perfil LinkedIn"),
    ('{scope}"{subject}" site:facebook.com', "perfil/menção no Facebook"),
    ('{scope}"{subject}" (site:x.com OR site:twitter.com)', "perfil/menção no Twitter/X"),
    ('{scope}"{subject}" site:instagram.com', "perfil/menção no Instagram"),
    ('{scope}"{subject}" (intitle:"currículo" OR intitle:"curriculo" OR intitle:"resume" OR intitle:"curriculum vitae")', "currículo publicado"),
    ('{scope}"{subject}" site:jusbrasil.com.br', "processo judicial público (Brasil)"),
    ('{scope}"{subject}" site:escavador.com', "registro público agregado (Brasil)"),
]

CONTACT_TEMPLATES = [
    ('{scope}"{subject}" site:pastebin.com', "vazamento em paste site"),
    ('{scope}"{subject}" (intext:"senha" OR intext:"password")', "possível vazamento de credencial"),
]


@dataclass
class DorkRequest:
    email: str | None = None
    phone: str | None = None
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    full_name: str | None = None
    domain: str | None = None
    file_extension: str | None = None


@dataclass
class DorkQuery:
    query: str
    intent: str


def _subjects(req: DorkRequest) -> list[tuple[str, str]]:
    """Retorna [(valor, tipo)] — tipo é "name" ou "contact", decide quais templates específicos aplicar."""
    subjects: list[tuple[str, str]] = []
    if req.full_name:
        subjects.append((req.full_name, "name"))
    elif req.first_name and req.last_name:
        subjects.append((f"{req.first_name} {req.last_name}", "name"))
    if req.email:
        subjects.append((req.email, "contact"))
    if req.phone:
        subjects.append((req.phone, "contact"))
    if req.username:
        subjects.append((req.username, "contact"))
    return subjects


def generate_dorks(req: DorkRequest) -> list[DorkQuery]:
    subjects = _subjects(req)

    if not subjects and not req.domain:
        raise ValueError("Informe pelo menos nome (ou nome+sobrenome), e-mail, telefone, username ou domínio.")

    if not subjects:
        # só domínio, sem campo pessoal -> reaproveita o recon de domínio puro já existente
        from app.recon.dork_generator import generate_dorks as generate_domain_dorks

        return [DorkQuery(query=d.query, intent=d.intent) for d in generate_domain_dorks(req.domain)]

    scope = f"site:{req.domain} " if req.domain else ""
    extensions = [req.file_extension] if req.file_extension else COMMON_DOC_EXTENSIONS
    ext_filter = " OR ".join(f"filetype:{ext}" for ext in extensions)

    dorks: list[DorkQuery] = []
    for subject, subject_type in subjects:
        dorks.append(DorkQuery(query=f'{scope}"{subject}"', intent=f'menção geral a "{subject}"'))
        dorks.append(DorkQuery(query=f'{scope}"{subject}" ({ext_filter})', intent=f'documento mencionando "{subject}"'))

        templates = NAME_TEMPLATES if subject_type == "name" else CONTACT_TEMPLATES
        for template, intent in templates:
            dorks.append(DorkQuery(query=template.format(scope=scope, subject=subject), intent=intent))

    if len(subjects) >= 2:
        combined = " ".join(f'"{s}"' for s, _ in subjects)
        dorks.append(DorkQuery(query=f"{scope}{combined}", intent="documento que menciona todos os campos juntos"))

    return dorks
