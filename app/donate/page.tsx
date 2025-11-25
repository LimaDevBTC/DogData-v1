"use client"

import { useState } from "react"
import { Layout } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Heart, 
  Copy, 
  Check, 
  ArrowLeft,
  Shield,
  Users,
  Star,
  X
} from "lucide-react"
import { SectionDivider } from "@/components/ui/section-divider"
import Image from "next/image"

const DONATION_ADDRESSES = {
  bitcoin: "bc1qkq43gqyr7gjzj0mxz0v7e0nzs3cm59g9jspc63",
  dog: "bc1pxk7aw9ug55jkkz02z7ayhlkxxq92ya0ctegcwm5j8jumgaavjlkqdylk2p",
  stacks: "SP18DX0ANJTAA3WWWA501QHR27J76KPGV9MQ0J01Y"
}

const DONATION_DATA = {
  bitcoin: {
    title: "Bitcoin (BTC)",
    description: "Support with Bitcoin",
    logo: "/BTC.png",
    qr: "/qrbtc.jpeg",
    color: "orange"
  },
  dog: {
    title: "DOG Rune",
    description: "Support with DOG",
    logo: "/DOG.png",
    qr: "/qrdog.jpeg",
    color: "orange"
  },
  stacks: {
    title: "Stacks (STX)",
    description: "Support with Stacks",
    logo: "/STX .png",
    qr: "/qrstx.jpeg",
    color: "orange"
  }
}

type DonationType = 'bitcoin' | 'dog' | 'stacks' | null

export default function DonatePage() {
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [selectedDonation, setSelectedDonation] = useState<DonationType>(null)

  const copyToClipboard = async (address: string, method: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopiedAddress(method)
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleLogoClick = (type: DonationType) => {
    setSelectedDonation(type)
  }

  const handleClose = () => {
    setSelectedDonation(null)
  }

  return (
    <Layout currentPage="donate" setCurrentPage={() => {}}>
      <div className="pt-2 pb-3 px-3 md:p-6 space-y-3 md:space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 md:space-y-4">
          <h1 className="text-4xl font-bold text-white font-mono flex items-center justify-center">
            <Heart className="w-10 h-10 mr-4 text-dog-orange" />
            Support DOG Community
          </h1>
        
          <p className="text-dog-gray-400 font-mono text-lg">
            Help us build the future of Bitcoin runes and ordinal technology
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-4 md:mt-8">
            <div className="flex items-center justify-center space-x-2 text-green-400">
              <Shield className="w-5 h-5" />
              <span className="font-mono text-sm">Secure & Transparent</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-blue-400">
              <Users className="w-5 h-5" />
              <span className="font-mono text-sm">Community Driven</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-yellow-400">
              <Star className="w-5 h-5" />
              <span className="font-mono text-sm">Open Source</span>
          </div>
        </div>
      </div>

      <SectionDivider title="Choose Your Donation Method" icon={Heart} />

      {/* Donation Methods - Logo Grid */}
        <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Bitcoin Logo Card */}
          <Card 
            variant="glass" 
            className="border-orange-500/20 hover:border-orange-500/60 transition-all cursor-pointer group"
            onClick={() => handleLogoClick('bitcoin')}
          >
            <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
              <div className="relative w-32 h-32 group-hover:scale-110 transition-transform duration-300">
                <Image
                  src="/BTC.png"
                  alt="Bitcoin"
                  width={128}
                  height={128}
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-2xl font-bold text-orange-400 font-mono">Bitcoin</h3>
              <p className="text-gray-400 text-sm font-mono text-center">
                Click to donate with BTC
              </p>
            </CardContent>
          </Card>

          {/* DOG Logo Card */}
          <Card 
            variant="glass" 
            className="border-orange-500/20 hover:border-orange-500/60 transition-all cursor-pointer group"
            onClick={() => handleLogoClick('dog')}
          >
            <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
              <div className="relative w-32 h-32 group-hover:scale-110 transition-transform duration-300">
                <Image
                  src="/DOG.png"
                  alt="DOG Rune"
                  width={128}
                  height={128}
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-2xl font-bold text-orange-400 font-mono">DOG</h3>
              <p className="text-gray-400 text-sm font-mono text-center">
                Click to donate with DOG
              </p>
            </CardContent>
          </Card>

          {/* Stacks Logo Card */}
          <Card 
            variant="glass" 
            className="border-orange-500/20 hover:border-orange-500/60 transition-all cursor-pointer group"
            onClick={() => handleLogoClick('stacks')}
          >
            <CardContent className="p-8 flex flex-col items-center justify-center space-y-4">
              <div className="relative w-32 h-32 group-hover:scale-110 transition-transform duration-300">
                <Image
                  src="/STX .png"
                  alt="Stacks"
                  width={128}
                  height={128}
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="text-2xl font-bold text-orange-400 font-mono">Stacks</h3>
              <p className="text-gray-400 text-sm font-mono text-center">
                Click to donate with STX
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Impact Section */}
          <SectionDivider title="Your Impact" icon={Star} />
          
          <div className="text-center space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card variant="glass" className="border-orange-500/20">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-orange-400 font-mono mb-2">
                  Research
                </div>
                <p className="text-gray-400 font-mono text-sm">
                  Advanced Bitcoin rune analytics and ordinal technology research
                </p>
              </CardContent>
            </Card>

            <Card variant="glass" className="border-orange-500/20">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-orange-400 font-mono mb-2">
                  Development
                </div>
                <p className="text-gray-400 font-mono text-sm">
                  Open-source tools and infrastructure for the DOG ecosystem
                </p>
              </CardContent>
            </Card>

            <Card variant="glass" className="border-orange-500/20">
              <CardContent className="p-6 text-center">
                <div className="text-4xl font-bold text-orange-400 font-mono mb-2">
                  Community
                </div>
                <p className="text-gray-400 font-mono text-sm">
                  Educational content and community building initiatives
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="max-w-2xl mx-auto">
            <p className="text-gray-300 font-mono text-lg leading-relaxed">
              Every donation, no matter the size, helps us continue building tools 
              that benefit the entire Bitcoin and DOG community. Thank you for your support! 🙏
            </p>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-12 text-center">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="btn-sharp"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          </div>
        </div>
      </div>

      {/* Modal Overlay for Donation Details */}
      {selectedDonation && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={handleClose}
        >
          <Card 
            variant="glass" 
            className="border-orange-500/40 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-orange-400 text-2xl font-mono">
                  {DONATION_DATA[selectedDonation].title}
                </CardTitle>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-gray-400 text-sm font-mono mt-2">
                {DONATION_DATA[selectedDonation].description}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* QR Code */}
              <div className="text-center">
                <div className="bg-black p-4 rounded-lg inline-block">
                  <Image
                    src={DONATION_DATA[selectedDonation].qr}
                    alt={`${DONATION_DATA[selectedDonation].title} QR Code`}
                    width={280}
                    height={280}
                    className="w-full h-auto"
                  />
                </div>
                <p className="text-xs text-gray-400 font-mono mt-3">Scan with your wallet</p>
              </div>

              {/* Address */}
              <div className="p-4 border border-orange-500/30 bg-orange-500/5">
                <div className="text-xs text-orange-400 font-mono mb-2 uppercase tracking-wide">Address:</div>
                <div className="font-mono text-sm break-all text-gray-200">
                  {DONATION_ADDRESSES[selectedDonation]}
                </div>
              </div>

              {/* Copy Button */}
              <Button
                variant="outline"
                size="lg"
                onClick={() => copyToClipboard(DONATION_ADDRESSES[selectedDonation], selectedDonation)}
                className="w-full btn-sharp bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30"
              >
                {copiedAddress === selectedDonation ? (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Address Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5 mr-2" />
                    Copy Address
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </Layout>
  )
}
