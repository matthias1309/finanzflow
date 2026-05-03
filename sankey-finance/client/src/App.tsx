import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "./context/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Categories from "./pages/Categories";
import Accounts from "./pages/Accounts";
import ImportPDF from "./pages/ImportPDF";
import Login from "./pages/Login";
import Users from "./pages/Users";
import NotFound from "./pages/not-found";
import Layout from "./components/Layout";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router hook={useHashLocation}>
          <Switch>
            <Route path="/login" component={Login} />
            <Route>
              <Layout>
                <Switch>
                  <Route path="/" component={Dashboard} />
                  <Route path="/transactions" component={Transactions} />
                  <Route path="/import" component={ImportPDF} />
                  <Route path="/accounts" component={Accounts} />
                  <Route path="/categories" component={Categories} />
                  <Route path="/users" component={Users} />
                  <Route component={NotFound} />
                </Switch>
              </Layout>
            </Route>
          </Switch>
        </Router>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
