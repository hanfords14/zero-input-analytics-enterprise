
history={}
def score(signal,success):
 history.setdefault(signal,[]).append(success)
 rate=sum(history[signal])/len(history[signal])
 if rate>0.75: return 'High'
 if rate>0.4: return 'Medium'
 return 'Low'
