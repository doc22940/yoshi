kubectl delete deployment --all --namespace=fed-infra
kubectl delete ingress --all --namespace=fed-infra
kubectl delete services --all --namespace=fed-infra
kubectl delete sa --all --namespace=fed-infra
kubectl delete job --all --namespace=fed-infra
kubectl delete pvc --all --namespace=fed-infra
kubectl delete secret --all --namespace=fed-infra
kubectl delete configmap --all --namespace=fed-infra
kubectl delete configmap --all --namespace=fed-infra
kubectl delete pods --all --namespace=fed-infra
kubectl delete poddisruptionbudgets.policy --all --namespace=fed-infra
kubectl delete statefulset --all --namespace=fed-infra
kubectl delete horizontalpodautoscalers.autoscaling --all --namespace=fed-infra