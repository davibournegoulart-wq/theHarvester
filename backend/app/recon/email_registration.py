import asyncio
from dataclasses import dataclass

@dataclass
class EmailRegistrationResult:
    registered_sites: list[str]
    total_checked: int
    discovered_by: str = "recon.email_registration.holehe"

async def check_email_registrations(email: str) -> EmailRegistrationResult:
    """Usa a ferramenta CLI holehe para checar se o email possui registro em mais de 120 sites."""
    try:
        proc = await asyncio.create_subprocess_shell(
            f"holehe {email} --only-used --no-color",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        
        output = stdout.decode('utf-8', errors='ignore')
        registered_sites = []
        for line in output.splitlines():
            line = line.strip()
            if line.startswith("[+]"):
                site = line.replace("[+]", "").strip()
                if site and not site.startswith("Email used"):
                    registered_sites.append(site)
                    
        return EmailRegistrationResult(
            registered_sites=registered_sites,
            total_checked=121
        )
    except Exception:
        return EmailRegistrationResult(registered_sites=[], total_checked=0)
