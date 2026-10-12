from fastapi import FastAPI, HTTPException
from data import DEALS, EMAILS
import json, os
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import agent
from data import DEALS

app = FastAPI(title="DealSense AI")

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/deals")
def list_deals():
    return DEALS

@app.get("/deals/{deal_id}")
def get_deal(deal_id: str):
    for d in DEALS:
        if d["id"] == deal_id:
            return d
    raise HTTPException(status_code=404, detail="Deal not found")

@app.get("/deals/{deal_id}/emails")
def get_emails(deal_id: str):
    return [e for e in EMAILS if e["deal_id"] == deal_id]

# Lets the React dev page (port 5173) call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class Question(BaseModel):
    question: str = Field(min_length=3, max_length=500)

class Approval(BaseModel):
    deal_id: str = Field(max_length=10)
    title: str = Field(min_length=3, max_length=200)
    reason: str = Field(min_length=3, max_length=1000)

@app.post("/investigate")
async def investigate_endpoint(body: Question):
    answer, calls, secs = await agent.investigate(body.question)
    # Keep only complete proposals (the model sometimes retries after
    # omitting 'reason'), and show the latest one.
    proposals = [
        c["args"] for c in calls
        if c["tool"] == "propose_followup_task"
        and all(c["args"].get(k) for k in ("deal_id", "title", "reason"))
    ]
    return {
        "answer": answer,
        "tool_calls": calls,
        "proposed_task": proposals[-1] if proposals else None,
        "seconds": round(secs, 1),
    }

@app.post("/approve")
def approve(body: Approval):
    ids = {d.get("id") or d.get("deal_id") for d in DEALS}
    if body.deal_id not in ids:
        raise HTTPException(status_code=404, detail="Unknown deal")
    tasks = []
    if os.path.exists("tasks.json"):
        with open("tasks.json") as f:
            tasks = json.load(f)
    tasks.append(body.model_dump())
    with open("tasks.json", "w") as f:
        json.dump(tasks, f, indent=2)
    return {"status": "created", "task": body.model_dump()}