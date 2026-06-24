FROM kalilinux/kali-rolling

RUN apt update && apt install -y \
    openssh-server nmap netcat-traditional curl wget \
    hydra sqlmap nikto whois dnsutils \
    sudo vim \
    && apt clean

RUN useradd -m -s /bin/bash analyst && \
    echo "analyst:analyst" | chpasswd

WORKDIR /home/analyst
USER analyst
CMD ["/bin/bash"]
