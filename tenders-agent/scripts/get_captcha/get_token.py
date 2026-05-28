#!/usr/bin/env python3
"""
Generate one or more ComprasNet captcha tokens.
Usage: python get_token.py [--count N]
Outputs one token per line to stdout.
"""

import argparse
from seleniumbase import Driver

URL = "https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras"

JS_GET_TOKEN = """
return new Promise((resolve, reject) => {
    (async function() {
        try {
            const el = document.querySelector('[data-hcaptcha-widget-id]');
            if (!el) return reject(new Error('No hCaptcha element'));
            const id = el.getAttribute('data-hcaptcha-widget-id');
            const r = await hcaptcha.execute(id, {async: true});
            resolve(r.response);
        } catch (e) { reject(e); }
    })();
});
"""

CHROME_ARGS = ",".join([
    "--disable-gpu", "--disable-dev-shm-usage", "--disable-extensions",
    "--disable-notifications", "--no-first-run", "--mute-audio", "--window-size=800,600",
])

BLOCKED = [
    "*.png", "*.jpg", "*.jpeg", "*.gif", "*.webp", "*.svg", "*.ico",
    "*.woff", "*.woff2", "*.ttf", "*.otf", "*.css",
    "*google-analytics*", "*googletagmanager*", "*doubleclick*",
]

def generate_tokens(count: int) -> list[str]:
    driver = Driver(uc=True, headless=True, locale="pt-br", chromium_arg=CHROME_ARGS, block_images=True)
    try:
        try:
            driver.execute_cdp_cmd("Network.enable", {})
            driver.execute_cdp_cmd("Network.setBlockedURLs", {"urls": BLOCKED})
        except Exception:
            pass
        driver.get(URL)
        driver.wait_for_element_present("[data-hcaptcha-widget-id]", timeout=15)
        return [t for _ in range(count) if (t := driver.execute_script(JS_GET_TOKEN))]
    finally:
        driver.quit()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate ComprasNet captcha tokens")
    parser.add_argument("--count", type=int, default=1)
    args = parser.parse_args()
    for token in generate_tokens(args.count):
        print(token)
