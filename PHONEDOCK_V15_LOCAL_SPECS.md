# PhoneDock v15 — Local Specs Database

1. Open Admin → Data Quality → Missing Specs.
2. Upload a specifications CSV in **Import local specifications dataset**.
3. Click **Find specs** for a phone.
4. Review the highest confidence local match and click Apply.

No AI or external runtime API is used. The imported dataset is stored in MongoDB collection `devicespecdatasets`.
